// Social preview image for the Spanish section's non-article pages.
import type { APIRoute } from 'astro';
import { CHURCH } from '../../consts';
import { renderOg } from '../../lib/og';

export const GET: APIRoute = async () => {
	const png = await renderOg({
		title: 'Artículos de Sermones',
		meta: `${CHURCH.city}, ${CHURCH.region}`,
		passage: '“Venid, oíd todos los que teméis a Dios” (Salmos 66:16)',
	});
	return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
