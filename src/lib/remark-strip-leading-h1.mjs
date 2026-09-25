// EchoPulpit (and hand-written posts, by convention) start each post's body
// with a "# Title" heading that duplicates the frontmatter `title` PostView
// already renders as its own styled <h1>. Rendering both left the title on
// the page twice -- and out of sync after an edit, since editing only
// updates the frontmatter, never the body. Strip that redundant heading
// structurally (whatever it says, not just when it matches the frontmatter)
// so the two can never disagree again.
export default function remarkStripLeadingH1() {
	return (tree) => {
		const first = tree.children[0];
		if (first && first.type === 'heading' && first.depth === 1) {
			tree.children.shift();
		}
	};
}
