// server/src/controllers/voidSale.controller.js
// PUT /api/sales/:id/void
//
// Void flow (from 03-api-contracts.md):
//   1. Validate sale exists + Status = 'Active'
//   2. UPDATE Sale.Status = 'Voided'  (+ Memo = reason)
//   3. UPDATE SaleLine.Status = 'Voided'
//   4. UPDATE SaleTender.Status = 'Voided'
//   5. For each InventoryItem referenced in sale lines:
//        a. INSERT InventoryHistory  BeforeValue='Sold'          AfterValue='Return Via Void'
//        b. INSERT InventoryHistory  BeforeValue='Return Via Void' AfterValue='Active'
//        c. UPDATE InventoryItem.StatusId = Active
//   Steps 3-5 follow the queue strategy: failures recorded but core void still returns.

const saleModel = require('../models/sale.model');

async function voidSale(req, res, next) {
    try {
        const saleId = req.params.id;
        const { reason } = req.body || {};

        // 1. Load sale — check exists and is voidable
        const sale = await saleModel.findSaleById(saleId);
        if (!sale) {
            return res.status(404).json({ error: 'SALE_NOT_FOUND', message: 'Sale not found.' });
        }
        if (sale.Status === 'Voided') {
            return res.status(409).json({ error: 'SALE_ALREADY_VOIDED', message: 'Sale is already voided.' });
        }

        const now    = new Date();
        const queued = [];

        // 2. Mark sale as Voided (core step — propagates the error if it fails)
        await saleModel.updateSaleVoided(saleId, reason, now);

        // 3. Void sale lines
        try {
            await saleModel.voidSaleLines(saleId);
        } catch (_err) {
            queued.push('SaleLine');
        }

        // 4. Void sale tenders
        try {
            await saleModel.voidSaleTenders(saleId);
        } catch (_err) {
            queued.push('SaleTender');
        }

        // 5. Reinstate each InventoryItem with two-step audit trail
        const inventoryItemIds = (sale.lines || [])
            .map((l) => l.InventoryItemId)
            .filter(Boolean);

        for (let i = 0; i < inventoryItemIds.length; i++) {
            const itemId = inventoryItemIds[i];
            // Offset timestamps by index so concurrent items never share a millisecond,
            // and the two rows for each item are always ordered Return Via Void → Active.
            const t1 = new Date(now.getTime() + i * 2);
            const t2 = new Date(now.getTime() + i * 2 + 1);

            try {
                await saleModel.insertInventoryHistory({
                    InventoryItemId: itemId,
                    ColumnName:      'StatusId',
                    BeforeValue:     'Sold',
                    AfterValue:      'Return Via Void',
                    ChangedAt:       t1,
                });
                await saleModel.insertInventoryHistory({
                    InventoryItemId: itemId,
                    ColumnName:      'StatusId',
                    BeforeValue:     'Return Via Void',
                    AfterValue:      'Active',
                    ChangedAt:       t2,
                });
            } catch (_err) {
                queued.push('InventoryHistory');
            }

            try {
                await saleModel.revertInventoryItemToActive(itemId, now);
            } catch (_err) {
                queued.push('InventoryItem');
            }
        }

        const httpStatus = queued.length > 0 ? 207 : 200;
        return res.status(httpStatus).json({
            saleId,
            status:    'Voided',
            voidedAt:  now.toISOString(),
            ...(queued.length > 0 ? { queued: [...new Set(queued)] } : {}),
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { voidSale };
