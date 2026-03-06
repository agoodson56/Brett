// POST /api/parts/:id/add — Add stock back to inventory
export async function onRequestPost(context) {
    const db = context.env.DB;
    const id = parseInt(context.params.id);

    try {
        const part = await db.prepare('SELECT * FROM parts WHERE id = ?').bind(id).first();
        if (!part) return Response.json({ error: 'Part not found' }, { status: 404 });

        const body = await context.request.json();
        const addQty = parseInt(body.quantity);

        if (!addQty || addQty <= 0) {
            return Response.json({ error: 'Quantity must be a positive number' }, { status: 400 });
        }

        const newQty = part.quantity + addQty;

        await db.prepare("UPDATE parts SET quantity = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(newQty, id).run();

        await db.prepare(
            `INSERT INTO transactions (part_id, action, quantity_change, quantity_before, quantity_after, notes) VALUES (?, 'ADDED', ?, ?, ?, ?)`
        ).bind(id, addQty, part.quantity, newQty, body.notes || `Added ${addQty} units`).run();

        const updated = await db.prepare('SELECT * FROM parts WHERE id = ?').bind(id).first();

        return Response.json({
            ...updated,
            message: `Added ${addQty} to ${part.part_number}. ${newQty} now in stock.`
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
