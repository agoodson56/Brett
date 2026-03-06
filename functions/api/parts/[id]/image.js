// GET /api/parts/:id/image — Serve part image from R2
export async function onRequestGet(context) {
    const db = context.env.DB;
    const bucket = context.env.BUCKET;
    const id = parseInt(context.params.id);

    try {
        const part = await db.prepare('SELECT image_key FROM parts WHERE id = ?').bind(id).first();
        if (!part || !part.image_key) {
            return new Response('No image found', { status: 404 });
        }

        const object = await bucket.get(part.image_key);
        if (!object) {
            return new Response('Image not found in storage', { status: 404 });
        }

        return new Response(object.body, {
            headers: {
                'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
                'Cache-Control': 'public, max-age=86400',
            }
        });
    } catch (error) {
        return new Response('Error loading image', { status: 500 });
    }
}
