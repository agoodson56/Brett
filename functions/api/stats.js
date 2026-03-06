// GET /api/stats — Dashboard statistics
export async function onRequestGet(context) {
    const db = context.env.DB;

    try {
        const totalParts = await db.prepare('SELECT COUNT(*) as count FROM parts').first();
        const totalQuantity = await db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM parts').first();
        const lowStock = await db.prepare('SELECT COUNT(*) as count FROM parts WHERE quantity <= 5 AND quantity > 0').first();
        const outOfStock = await db.prepare('SELECT COUNT(*) as count FROM parts WHERE quantity = 0').first();

        const { results: recentTransactions } = await db.prepare(`
            SELECT t.*, p.part_number FROM transactions t
            JOIN parts p ON t.part_id = p.id
            ORDER BY t.created_at DESC LIMIT 10
        `).all();

        return Response.json({
            totalParts: totalParts?.count || 0,
            totalQuantity: totalQuantity?.total || 0,
            lowStock: lowStock?.count || 0,
            outOfStock: outOfStock?.count || 0,
            recentTransactions: recentTransactions || []
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
