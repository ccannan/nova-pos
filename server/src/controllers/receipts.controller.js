// server/src/controllers/receipts.controller.js
// GET /api/sales/:id/receipt

const saleModel = require('../models/sale.model');

async function getReceipt(req, res, next) {
    try {
        const row = await saleModel.getReceiptContent(req.params.id);

        if (!row) {
            return res.status(404).json({ error: 'SALE_NOT_FOUND', message: 'Sale not found.' });
        }
        if (!row.ReceiptContent) {
            return res.status(404).json({
                error:   'RECEIPT_NOT_GENERATED',
                message: 'Receipt has not been generated for this sale yet.',
            });
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(row.ReceiptContent);
    } catch (err) {
        next(err);
    }
}

module.exports = { getReceipt };
