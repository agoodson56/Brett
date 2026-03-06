// POST /api/parts/:id/take — Take parts from inventory
export async function onRequestPost(context) {
    const db = context.env.DB;
    const id = parseInt(context.params.id);

    try {
        const part = await db.prepare('SELECT * FROM parts WHERE id = ?').bind(id).first();
        if (!part) return Response.json({ error: 'Part not found' }, { status: 404 });

        const body = await context.request.json();
        const takeQty = parseInt(body.quantity);

        if (!takeQty || takeQty <= 0) {
            return Response.json({ error: 'Quantity must be a positive number' }, { status: 400 });
        }
        if (takeQty > part.quantity) {
            return Response.json({
                error: `Cannot take ${takeQty}. Only ${part.quantity} available.`,
                available: part.quantity
            }, { status: 400 });
        }

        const newQty = part.quantity - takeQty;

        await db.prepare("UPDATE parts SET quantity = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(newQty, id).run();

        await db.prepare(
            `INSERT INTO transactions (part_id, action, quantity_change, quantity_before, quantity_after, notes) VALUES (?, 'TAKEN', ?, ?, ?, ?)`
        ).bind(id, -takeQty, part.quantity, newQty, body.notes || `Took ${takeQty} units`).run();

        const updated = await db.prepare('SELECT * FROM parts WHERE id = ?').bind(id).first();

        return Response.json({
            ...updated,
            message: `Took ${takeQty} of ${part.part_number}. ${newQty} remaining.`
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
