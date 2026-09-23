"""
Import finished EchoPulpit articles into this blog as drafts.

For every COMPLETE EchoPulpit job, reads its scripture-verified article.json
from S3, keeps only the public fields (never reviewer notes or review
flags), fills in details from the church's Subsplash podcast feed (the
real preacher's name and the sermon audio), and writes
src/content/drafts/<date>-<slug>.md. Drafts are git-ignored and only show
in `npm run dev`; `npm run publish-draft -- <slug>` publishes one.

Skips jobs already imported (as a draft or a post), jobs whose sermon
transcript is too short to be a real sermon, and anything listed in
--exclude.

Usage (from the repo root, with AWS credentials for the EchoPulpit account):
    python scripts/import_echopulpit.py            # dry run: list what would be imported
    python scripts/import_echopulpit.py --apply
    python scripts/import_echopulpit.py --apply --exclude VIDEO_ID [VIDEO_ID...]
Needs: pip install boto3 pyyaml
"""
import argparse
import json
import os
import re
import ssl
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from zoneinfo import ZoneInfo

import boto3
import yaml

BUCKET = os.environ.get("ARTIFACTS_BUCKET", "echopulpit-artifacts")
TABLE = os.environ.get("TABLE_NAME", "EchoPulpitJobs")
REGION = os.environ.get("AWS_REGION", "us-east-1")
FEED_URL = os.environ.get("FEED_URL", "https://podcasts.subsplash.com/bg23rt3/podcast.rss")
CHURCH_TZ = ZoneInfo(os.environ.get("CHURCH_TIMEZONE", "America/Chicago"))
MIN_SERMON_WORDS = 400
SERVICES = ["Sunday Main Worship", "Sunday Afternoon Worship", "Weekly Bible Hour", "Midweek Worship Service"]
ITUNES = {"itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd"}

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
# EchoPulpit checkout, for its KJV scripture verifier (optional)
ECHOPULPIT_DIR = os.environ.get("ECHOPULPIT_DIR", os.path.join(ROOT, "..", "EchoPulpit"))
DRAFTS = os.path.join(ROOT, "src", "content", "drafts")
POSTS = os.path.join(ROOT, "src", "content", "posts")

s3 = boto3.client("s3", region_name=REGION)
table = boto3.resource("dynamodb", region_name=REGION).Table(TABLE)


def norm(title: str) -> str:
    return " ".join((title or "").split()).casefold()


def fetch_feed() -> list:
    ctx = None
    try:  # Windows' certificate store can be broken for Python; certifi if present
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    with urllib.request.urlopen(FEED_URL, timeout=60, context=ctx) as resp:
        channel = ET.fromstring(resp.read()).find("channel")
    episodes = []
    for item in channel.findall("item"):
        enc = item.find("enclosure")
        pub = item.findtext("pubDate")
        if enc is None or not pub:
            continue
        try:
            duration = float(item.findtext("itunes:duration", default="0", namespaces=ITUNES) or 0)
        except ValueError:
            duration = 0.0
        episodes.append({
            "title": (item.findtext("title") or "").strip(),
            "date": parsedate_to_datetime(pub).date(),
            "duration": duration,
            "audio": enc.get("url"),
            "author": (item.findtext("itunes:author", default="", namespaces=ITUNES) or "").strip(),
            "guid": (item.findtext("guid") or "").strip(),
        })
    return episodes


def match_episode(episodes, job):
    """Same rule the EchoPulpit worker uses: same title, dated the stream's
    UTC end date or the day before; closest duration wins."""
    vid = job["video_id"]
    if vid.startswith("subsplash-"):
        guid = vid[len("subsplash-"):]
        return next((e for e in episodes if e["guid"] == guid), None)
    end = job.get("actual_end_time")
    if not end:
        return None
    end_date = datetime.fromisoformat(end.replace("Z", "+00:00")).astimezone(timezone.utc).date()
    cands = [e for e in episodes
             if norm(e["title"]) == norm(job.get("title", ""))
             and end_date - timedelta(days=1) <= e["date"] <= end_date]
    dur = float(job.get("video_duration_seconds") or 0)
    return min(cands, key=lambda e: abs(e["duration"] - dur)) if cands else None


def service_of(title: str):
    for s in SERVICES:
        if norm(title) == norm(s) or norm(title).endswith(norm(s)):
            return s
    return None


def service_date(job, episode) -> date:
    if episode and job["video_id"].startswith("subsplash-"):
        return episode["date"]
    end = job.get("actual_end_time")
    if end:
        return datetime.fromisoformat(end.replace("Z", "+00:00")).astimezone(CHURCH_TZ).date()
    return episode["date"] if episode else date.today()


def existing_ids():
    """sourceId and slug of every draft/post already on disk."""
    ids, slugs = set(), set()
    for folder in (DRAFTS, POSTS):
        for fn in os.listdir(folder):
            if not fn.endswith(".md"):
                continue
            text = open(os.path.join(folder, fn), encoding="utf-8").read()
            m = re.search(r"^sourceId:\s*['\"]?([^'\"\n]+)", text, re.M)
            if m:
                ids.add(m.group(1).strip())
            m = re.search(r"^slug:\s*['\"]?([^'\"\n]+)", text, re.M)
            if m:
                slugs.add(m.group(1).strip())
    return ids, slugs


def separate_blockquotes(markdown: str) -> str:
    """EchoPulpit writes the paragraph after a scripture quote on the very
    next line ('> "..." (Ref)\\nNext paragraph'). Markdown treats that as a
    continuation of the quote, pulling the commentary into the quote box,
    so end each quote with a blank line."""
    return re.sub(r"^(>[^\n]*\n)(?=[^>\s])", r"\1\n", markdown, flags=re.M)


def get_text(key: str) -> str:
    return s3.get_object(Bucket=BUCKET, Key=key)["Body"].read().decode("utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apply", action="store_true", help="write the drafts (default: dry run)")
    ap.add_argument("--exclude", nargs="*", default=[], help="EchoPulpit video IDs to skip")
    args = ap.parse_args()

    jobs, kwargs = [], {}
    while True:
        resp = table.scan(**kwargs)
        jobs += [j for j in resp["Items"] if j.get("status") == "COMPLETE" and j.get("s3_prefix")]
        if "LastEvaluatedKey" not in resp:
            break
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]

    episodes = fetch_feed()
    have_ids, have_slugs = existing_ids()

    # Articles generated before EchoPulpit bundled its KJV text were never
    # scripture-checked; run the same verifier on them here if available.
    verify = None
    sys.path.insert(0, ECHOPULPIT_DIR)
    try:
        from scripture_lookup import kjv_available, verify_and_correct_scripture
        if kjv_available():
            verify = verify_and_correct_scripture
    except ImportError:
        pass
    if verify is None:
        print(f"note: EchoPulpit's scripture verifier not found at {ECHOPULPIT_DIR}; "
              "unverified articles will be imported as-is\n")
    written = 0

    for job in sorted(jobs, key=lambda j: j.get("actual_end_time", "")):
        vid = job["video_id"]
        prefix = f"sermons/{vid}/"
        label = f"{vid} ({job.get('title', '')})"
        if vid in args.exclude:
            print(f"skip   {label}: excluded")
            continue
        if vid in have_ids:
            print(f"skip   {label}: already imported")
            continue
        try:
            words = len(get_text(prefix + "sermon.txt").split())
            article = json.loads(get_text(prefix + "article.json"))
        except s3.exceptions.NoSuchKey:
            print(f"skip   {label}: artifacts missing in S3")
            continue
        if words < MIN_SERMON_WORDS:
            print(f"skip   {label}: sermon transcript only {words} words")
            continue

        ep = match_episode(episodes, job)
        pub = service_date(job, ep)
        slug = article.get("slug") or re.sub(r"[^a-z0-9]+", "-", article["title"].lower()).strip("-")
        if slug in have_slugs:
            slug = f"{slug}-{pub.isoformat()}"
        service = service_of(job.get("title", "")) or (service_of(ep["title"]) if ep else None)

        front = {
            "title": article["title"],
            "slug": slug,
            "description": article.get("meta_description") or "",
            "pubDate": pub.isoformat(),
            "preacher": ep["author"] if ep and ep["author"] else None,
            "service": service,
            "primaryPassage": article.get("primary_passage") or None,
            "scripture": article.get("scripture_references") or [],
            "keywords": article.get("keywords") or [],
            "tags": [],
            "audioUrl": ep["audio"] if ep else None,
            "videoUrl": None if vid.startswith("subsplash-") else f"https://www.youtube.com/watch?v={vid}",
            "sourceId": vid,
        }
        front = {k: v for k, v in front.items() if v not in (None, "")}
        body = separate_blockquotes(article["article_markdown"].strip() + "\n")
        unverified = any("NOT independently verified" in f for f in (article.get("reviewer_notes") or {}).get("flags", []))
        note = ""
        if unverified and verify:
            body, refs, flags = verify(body)
            front["scripture"] = refs
            note = f"  [scripture verified now: {len(refs)} ok, {len(flags)} removed]"
            for f in flags:
                note += f"\n         removed: {f[:110]}"
        elif unverified:
            note = "  [scripture NOT verified]"

        fn = f"{pub.isoformat()}-{slug}.md"
        print(f"{'write' if args.apply else 'would'}  {label} -> drafts/{fn}"
              f"  preacher={front.get('preacher', '-')}  audio={'yes' if 'audioUrl' in front else 'no'}{note}")
        if args.apply:
            with open(os.path.join(DRAFTS, fn), "w", encoding="utf-8", newline="\n") as f:
                f.write("---\n" + yaml.safe_dump(front, sort_keys=False, allow_unicode=True, width=1000) + "---\n\n" + body)
            have_ids.add(vid)
            have_slugs.add(slug)
            written += 1

    print(f"\n{written} draft(s) written." if args.apply else "\nDry run -- nothing written. Re-run with --apply.")


if __name__ == "__main__":
    sys.exit(main())
