const fs   = require('fs');
const path = require('path');
const saleModel = require('../models/sale.model');
const { uuid }  = require('../models/base');
const { generateReceipt } = require('../printing/receipt.template');
const { findStoreById }   = require('../models/store.model');

const QUEUE_DIR  = process.env.QUEUE_DIR || path.join(__dirname, '..', '..', 'tests', 'tmp', 'queue');
const PENDING_DIR = path.join(QUEUE_DIR, 'pending');

const VALID_TENDER_METHODS = new Set(['Cash', 'Card', 'Voucher', 'Layby']);

function ensureQueueDirs() {
    for (const sub of ['pending', 'processed', 'failed']) {
        const dir = path.join(QUEUE_DIR, sub);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
}

function writeQueueFile(filename, data) {
    ensureQueueDirs();
    fs.writeFileSync(path.join(PENDING_DIR, filename), JSON.stringify(data, null, 2), 'utf8');
}

function makeQueueFilename() {
    return `${new Date().toISOString().replace(/[:.]/g, '-')}-${uuid()}.json`;
}

// ─── camelCase converters ────────────────────────────────────────────────────

function saleListRow(row) {
    return {
        saleId:       row.SaleId,
        saleNumber:   parseInt(row.SaleNumber,  10),
        saleDate:     row.SaleDate,
        customerName: row.CustomerName,
        grandTotal:   parseFloat(row.GrandTotal) || 0,
        status:       row.Status,
        lineCount:    parseInt(row.LineCount, 10) || 0,
    };
}

function saleDetailRow(row) {
    return {
        saleId:        (row.SaleId || '').toLowerCase(),
        saleNumber:    parseInt(row.SaleNumber,     10),
        saleDate:      row.SaleDate,
        storeId:       row.StoreId,
        storeName:     row.StoreName,
        customerId:    row.CustomerId,
        customerName:  row.CustomerName,
        subTotal:      parseFloat(row.SubTotal)      || 0,
        discountTotal: parseFloat(row.DiscountTotal) || 0,
        grandTotal:    parseFloat(row.GrandTotal)    || 0,
        status:        row.Status,
        memo:          row.Memo || '',
    };
}

function saleLineRow(row) {
    return {
        saleLineId:      row.SaleLineId,
        saleId:          row.SaleId,
        lineNumber:      parseInt(row.LineNumber, 10),
        inventoryItemId: row.InventoryItemId,
        description:     row.Description || '',
        unitPrice:       parseFloat(row.UnitPrice) || 0,
        discount:        parseFloat(row.Discount)  || 0,
        lineTotal:       parseFloat(row.LineTotal) || 0,
        status:          row.Status,
    };
}

function saleTenderRow(row) {
    return {
        saleTenderId: row.SaleTenderId,
        saleId:       row.SaleId,
        tenderMethod: row.TenderMethod,
        amount:       parseFloat(row.Amount) || 0,
        reference:    row.Reference,
        status:       row.Status,
    };
}

// ─── POST /api/sales ─────────────────────────────────────────────────────────

async function createSale(req, res, next) {
    try {
        const { storeId, customerId, memo, lines = [], tender = [] } = req.body;

        // Validation
        const fields = {};
        if (!storeId)                                          fields.storeId = 'Required.';
        if (!Array.isArray(lines) || lines.length === 0)      fields.lines   = 'At least one line is required.';
        if (!Array.isArray(tender) || tender.length === 0)    fields.tender  = 'At least one tender entry is required.';

        if (Object.keys(fields).length > 0) {
            return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Validation failed.', fields });
        }

        for (const t of tender) {
            if (!VALID_TENDER_METHODS.has(t.tenderMethod)) {
                return res.status(400).json({
                    error: 'VALIDATION_FAILED',
                    message: `Invalid tender method: ${t.tenderMethod}.`,
                    fields: { tenderMethod: 'Invalid.' },
                });
            }
        }

        const grandTotal    = lines.reduce((s, l) => s + (l.unitPrice - (l.discount || 0)), 0);
        const discountTotal = lines.reduce((s, l) => s + (l.discount || 0), 0);
        const subTotal      = grandTotal;
        const tenderSum     = tender.reduce((s, t) => s + t.amount, 0);

        if (Math.abs(tenderSum - grandTotal) > 0.001) {
            return res.status(400).json({
                error: 'VALIDATION_FAILED',
                message: 'Tender sum does not equal grand total.',
                fields: { tender: 'Must equal grand total.' },
            });
        }

        // Atomic inventory claim
        const inventoryItemIds = lines.map(l => l.inventoryItemId);
        const { claimed, conflicts } = await saleModel.checkAndClaimInventoryItems(inventoryItemIds);

        if (conflicts.length > 0) {
            if (claimed.length > 0) await saleModel.revertInventoryItems(claimed);
            return res.status(409).json({
                error: 'INVENTORY_ITEM_NOT_ACTIVE',
                message: 'One or more inventory items are not available for sale.',
                conflictingIds: conflicts,
            });
        }

        // Pre-generate all IDs so the queue file is self-contained and replayable.
        const saleId     = uuid();
        const lineIds    = lines.map(() => uuid());
        const tenderIds  = tender.map(() => uuid());
        const historyIds = claimed.map(() => uuid());
        const now        = new Date().toISOString();

        // Build the complete set of DB operations. The processor replays these,
        // skipping any that already exist (idempotent by PK).
        function buildSaleOps(saleNumber) {
            return [
                {
                    step: 'INSERT_SALE', table: 'Sale', operation: 'INSERT',
                    data: {
                        SaleId:        saleId,
                        StoreId:       storeId,
                        CustomerId:    customerId || null,
                        CustomerName:  null,
                        SaleNumber:    saleNumber,   // null when DB is down; processor computes it
                        SaleDate:      now,
                        SubTotal:      subTotal,
                        DiscountTotal: discountTotal,
                        GrandTotal:    grandTotal,
                        Status:        'Active',
                        Memo:          memo || null,
                        IsDeleted:     0,
                        CreatedAt:     now,
                        UpdatedAt:     now,
                    },
                },
                ...lines.map((line, i) => ({
                    step: 'INSERT_SALE_LINE', table: 'SaleLine', operation: 'INSERT',
                    data: {
                        SaleLineId:      lineIds[i],
                        SaleId:          saleId,
                        LineNumber:      i + 1,
                        InventoryItemId: line.inventoryItemId,
                        Description:     line.description || null,
                        UnitPrice:       line.unitPrice,
                        Discount:        line.discount || 0,
                        LineTotal:       line.unitPrice - (line.discount || 0),
                        IsDeleted:       0,
                        Status:          'Active',
                        CreatedAt:       now,
                    },
                })),
                ...tender.map((t, i) => ({
                    step: 'INSERT_SALE_TENDER', table: 'SaleTender', operation: 'INSERT',
                    data: {
                        SaleTenderId: tenderIds[i],
                        SaleId:       saleId,
                        TenderMethod: t.tenderMethod,
                        Amount:       t.amount,
                        Reference:    t.reference || null,
                        Status:       'Active',
                        CreatedAt:    now,
                    },
                })),
                ...claimed.map((id, i) => ({
                    step: 'INSERT_INVENTORY_HISTORY', table: 'InventoryHistory', operation: 'INSERT',
                    data: {
                        InventoryHistoryId: historyIds[i],
                        InventoryItemId:    id,
                        ColumnName:         'StatusId',
                        BeforeValue:        saleModel.ACTIVE_STATUS_ID,
                        AfterValue:         saleModel.SOLD_STATUS_ID,
                        ChangedAt:          now,
                        UserId:             null,
                    },
                })),
            ];
        }

        // Insert Sale
        let saleRow;
        try {
            saleRow = await saleModel.insertSale({
                SaleId:        saleId,
                StoreId:       storeId,
                CustomerId:    customerId || null,
                CustomerName:  null,
                SubTotal:      subTotal,
                DiscountTotal: discountTotal,
                GrandTotal:    grandTotal,
                Memo:          memo || null,
            });
        } catch (saleErr) {
            // Items are already claimed (Sold). Write the full sale to the queue —
            // the processor will insert everything when the DB is restored.
            // Do NOT revert items; they are reserved for this queued sale.
            const queueId  = uuid();
            const filename = makeQueueFilename();
            writeQueueFile(filename, {
                queueId,
                createdAt:     new Date().toISOString(),
                retryCount:    0,
                lastAttemptAt: null,
                operations:    buildSaleOps(null),  // SaleNumber computed at replay time
            });
            return res.status(202).json({
                queued:   true,
                queueRef: filename,
                message:  'Sale has been saved locally and will be submitted when the connection is restored.',
            });
        }

        const saleNumber = saleRow.SaleNumber;
        const queued     = [];

        // Insert SaleLines
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            try {
                await saleModel.insertSaleLine({
                    SaleLineId:      lineIds[i],
                    SaleId:          saleId,
                    LineNumber:      i + 1,
                    InventoryItemId: line.inventoryItemId,
                    Description:     line.description || null,
                    UnitPrice:       line.unitPrice,
                    Discount:        line.discount || 0,
                });
            } catch (_err) {
                queued.push('SaleLine');
            }
        }

        // Insert SaleTender
        for (let i = 0; i < tender.length; i++) {
            const t = tender[i];
            try {
                await saleModel.insertSaleTender({
                    SaleTenderId: tenderIds[i],
                    SaleId:       saleId,
                    TenderMethod: t.tenderMethod,
                    Amount:       t.amount,
                    Reference:    t.reference || null,
                });
            } catch (_err) {
                queued.push('SaleTender');
            }
        }

        // Insert InventoryHistory for each claimed item
        for (let i = 0; i < claimed.length; i++) {
            try {
                await saleModel.insertInventoryHistory({
                    InventoryHistoryId: historyIds[i],
                    InventoryItemId:    claimed[i],
                    BeforeValue:        saleModel.ACTIVE_STATUS_ID,
                    AfterValue:         saleModel.SOLD_STATUS_ID,
                });
            } catch (_err) {
                queued.push('InventoryHistory');
            }
        }

        // Build receipt data — best-effort store lookup for address/phone
        let store = null;
        try { store = await findStoreById(storeId); } catch (_) {}

        const receiptData = {
            saleNumber,
            saleDate:     new Date().toISOString(),
            storeName:    store ? store.StoreName : null,
            storePhone:   store ? store.Phone     : null,
            storeEmail:   store ? store.Email     : null,
            storeAddress: store
                ? [store.AddressLine1, store.City, store.State].filter(Boolean).join(', ')
                : null,
            customerName: null,  // customerId not resolved to name at sale creation time
            subTotal,
            discountTotal,
            grandTotal,
            lines:  lines.map((l, i) => ({
                lineNumber:  i + 1,
                description: l.description || '',
                unitPrice:   l.unitPrice,
                discount:    l.discount || 0,
                lineTotal:   l.unitPrice - (l.discount || 0),
            })),
            tender: tender.map((t) => ({ tenderMethod: t.tenderMethod, amount: t.amount })),
        };
        const receiptHtml = generateReceipt(receiptData);

        // Step 6/7: store receipt — strip newlines so sqlcmd pipe-delimited output
        // doesn't misparse multi-line values as extra rows on SELECT *.
        const receiptHtmlForStorage = receiptHtml.replace(/\r?\n/g, '');
        try { await saleModel.updateSaleReceiptContent(saleId, receiptHtmlForStorage); } catch (_) {}

        if (queued.length > 0) {
            const queueId  = uuid();
            const filename = makeQueueFilename();
            // Write the complete sale ops — processor skips rows that already exist.
            writeQueueFile(filename, {
                queueId,
                createdAt:     new Date().toISOString(),
                retryCount:    0,
                lastAttemptAt: null,
                operations:    buildSaleOps(saleNumber),
            });
            return res.status(207).json({
                saleId,
                saleNumber,
                status:      'Active',
                grandTotal,
                receiptHtml,
                queued:      [...new Set(queued)],
            });
        }

        return res.status(201).json({
            saleId,
            saleNumber,
            status:      'Active',
            grandTotal,
            receiptHtml,
            queued: [],
        });
    } catch (err) {
        next(err);
    }
}

// ─── GET /api/sales ──────────────────────────────────────────────────────────

async function getSales(req, res, next) {
    try {
        const { from, to, customerId, storeId, status, page = '1', limit = '20' } = req.query;
        const pageNum  = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));

        const result = await saleModel.findSales({
            from, to, customerId, storeId, status,
            page:  pageNum,
            limit: limitNum,
        });

        res.json({
            total:   result.total,
            page:    pageNum,
            limit:   limitNum,
            results: result.results.map(saleListRow),
        });
    } catch (err) {
        next(err);
    }
}

// ─── GET /api/sales/:id ──────────────────────────────────────────────────────

async function getSale(req, res, next) {
    try {
        const sale = await saleModel.findSaleById(req.params.id);
        if (!sale) {
            return res.status(404).json({ error: 'SALE_NOT_FOUND', message: 'Sale not found.' });
        }
        res.json({
            ...saleDetailRow(sale),
            lines:  sale.lines.map(saleLineRow),
            tender: sale.tender.map(saleTenderRow),
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { createSale, getSales, getSale };
