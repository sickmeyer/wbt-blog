// Social preview image for the home page and other non-article pages.
import type { APIRoute } from 'astro';
import { CHURCH } from '../../consts';
import { renderOg } from '../../lib/og';

export const GET: APIRoute = async () => {
	const png = await renderOg({
		title: 'Sermon Articles',
		meta: `${CHURCH.city}, ${CHURCH.region}`,
		passage: `“Come and hear, all ye that fear God” (${CHURCH.taglineRef})`,
	});
	return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
