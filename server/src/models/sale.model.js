const { query, insertAndReturn, uuid } = require('./base');

const ACTIVE_STATUS_ID = '10000001-0000-0000-0000-000000000001';
const SOLD_STATUS_ID   = '10000001-0000-0000-0000-000000000002';

// Attempt atomic UPDATE: Active → Sold. rowsAffected=0 means item wasn't Active.
async function checkAndClaimInventoryItems(inventoryItemIds) {
    const claimed = [];
    const conflicts = [];
    const now = new Date();

    for (const id of inventoryItemIds) {
        const result = await query(
            `UPDATE InventoryItem
             SET StatusId = @SoldStatusId, StatusUpdatedDT = @ClaimTime, UpdatedAt = @ClaimTime
             WHERE InventoryItemId = @InventoryItemId AND StatusId = @ActiveStatusId`,
            { SoldStatusId: SOLD_STATUS_ID, InventoryItemId: id, ActiveStatusId: ACTIVE_STATUS_ID, ClaimTime: now }
        );
        if (result.rowsAffected[0] > 0) {
            claimed.push(id);
        } else {
            conflicts.push(id);
        }
    }
    return { claimed, conflicts };
}

async function revertInventoryItems(inventoryItemIds) {
    const now = new Date();
    for (const id of inventoryItemIds) {
        await query(
            `UPDATE InventoryItem
             SET StatusId = @ActiveStatusId, StatusUpdatedDT = @RevertTime, UpdatedAt = @RevertTime
             WHERE InventoryItemId = @InventoryItemId`,
            { ActiveStatusId: ACTIVE_STATUS_ID, InventoryItemId: id, RevertTime: now }
        );
    }
}

async function getNextSaleNumber(storeId) {
    const result = await query(
        `SELECT ISNULL(MAX(SaleNumber), 0) + 1 AS NextNum FROM Sale WHERE StoreId = @StoreId`,
        { StoreId: storeId }
    );
    return parseInt(result.recordset[0].NextNum, 10);
}

async function insertSale(data) {
    const saleId     = data.SaleId || uuid();
    const now        = new Date();
    const saleNumber = data.SaleNumber != null ? data.SaleNumber : await getNextSaleNumber(data.StoreId);

    await query(
        `INSERT INTO Sale (SaleId, StoreId, CustomerId, CustomerName, SaleNumber, SaleDate,
                           SubTotal, DiscountTotal, GrandTotal, Status, Memo, IsDeleted, CreatedAt, UpdatedAt)
         VALUES (@SaleId, @StoreId, @CustomerId, @CustomerName, @SaleNumber, @SaleDate,
                 @SubTotal, @DiscountTotal, @GrandTotal, 'Active', @Memo, 0, @CreatedAt, @UpdatedAt)`,
        {
            SaleId:        saleId,
            StoreId:       data.StoreId,
            CustomerId:    data.CustomerId  || null,
            CustomerName:  data.CustomerName || null,
            SaleNumber:    saleNumber,
            SaleDate:      now,
            SubTotal:      data.SubTotal,
            DiscountTotal: data.DiscountTotal || 0,
            GrandTotal:    data.GrandTotal,
            Memo:          data.Memo || null,
            CreatedAt:     now,
            UpdatedAt:     now,
        }
    );

    return { SaleId: saleId, SaleNumber: saleNumber, Status: 'Active', GrandTotal: data.GrandTotal };
}

async function insertSaleLine(data) {
    const saleLineId = data.SaleLineId || uuid();
    await insertAndReturn('SaleLine', 'SaleLineId', {
        SaleLineId:      saleLineId,
        SaleId:          data.SaleId,
        LineNumber:      data.LineNumber,
        InventoryItemId: data.InventoryItemId,
        Description:     data.Description || null,
        UnitPrice:       data.UnitPrice,
        Discount:        data.Discount || 0,
        LineTotal:       data.UnitPrice - (data.Discount || 0),
        IsDeleted:       0,
        Status:          'Active',
        CreatedAt:       new Date(),
    });
    return saleLineId;
}

async function insertSaleTender(data) {
    const saleTenderId = data.SaleTenderId || uuid();
    await insertAndReturn('SaleTender', 'SaleTenderId', {
        SaleTenderId: saleTenderId,
        SaleId:       data.SaleId,
        TenderMethod: data.TenderMethod,
        Amount:       data.Amount,
        Reference:    data.Reference || null,
        Status:       'Active',
        CreatedAt:    new Date(),
    });
    return saleTenderId;
}

async function insertInventoryHistory(data) {
    await insertAndReturn('InventoryHistory', 'InventoryHistoryId', {
        InventoryHistoryId: data.InventoryHistoryId || uuid(),
        InventoryItemId:    data.InventoryItemId,
        ColumnName:         data.ColumnName || 'StatusId',
        BeforeValue:        data.BeforeValue,
        AfterValue:         data.AfterValue,
        ChangedAt:          data.ChangedAt || new Date(),
        UserId:             data.UserId || null,
    });
}

async function findSales(options = {}) {
    const { from, to, customerId, storeId, status, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const conditions = ['s.IsDeleted = 0'];
    const params = {};

    if (from)       { conditions.push('s.SaleDate >= @FromDate');   params.FromDate   = new Date(from); }
    if (to)         { conditions.push('s.SaleDate <= @ToDate');     params.ToDate     = new Date(to); }
    if (customerId) { conditions.push('s.CustomerId = @CustId');    params.CustId     = customerId; }
    if (storeId)    { conditions.push('s.StoreId = @StoreId');      params.StoreId    = storeId; }
    if (status)     { conditions.push('s.Status = @SaleStatus');    params.SaleStatus = status; }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
        `SELECT COUNT(*) AS total FROM Sale s ${where}`,
        params
    );
    const total = parseInt(countResult.recordset[0].total, 10) || 0;

    const dataResult = await query(
        `SELECT s.SaleId, s.SaleNumber, s.SaleDate, s.CustomerName, s.GrandTotal, s.Status,
                (SELECT COUNT(*) FROM SaleLine sl WHERE sl.SaleId = s.SaleId AND sl.IsDeleted = 0) AS LineCount
         FROM Sale s ${where}
         ORDER BY s.SaleDate DESC
         OFFSET @PageOffset ROWS FETCH NEXT @PageLimit ROWS ONLY`,
        { ...params, PageOffset: offset, PageLimit: limit }
    );

    return { total, results: dataResult.recordset };
}

async function findSaleById(id) {
    const saleResult = await query(
        `SELECT s.*, st.StoreName
         FROM Sale s
         JOIN Store st ON s.StoreId = st.StoreId
         WHERE s.SaleId = @SaleId AND s.IsDeleted = 0`,
        { SaleId: id }
    );
    if (!saleResult.recordset[0]) return null;

    const linesResult = await query(
        `SELECT * FROM SaleLine WHERE SaleId = @SaleId AND IsDeleted = 0 ORDER BY LineNumber`,
        { SaleId: id }
    );

    const tenderResult = await query(
        `SELECT * FROM SaleTender WHERE SaleId = @SaleId ORDER BY CreatedAt`,
        { SaleId: id }
    );

    return {
        ...saleResult.recordset[0],
        lines:  linesResult.recordset,
        tender: tenderResult.recordset,
    };
}

// ─── Void sale ───────────────────────────────────────────────────────────────

async function updateSaleVoided(saleId, reason, now) {
    await query(
        `UPDATE Sale SET Status = 'Voided', Memo = @Memo, UpdatedAt = @Now WHERE SaleId = @SaleId`,
        { SaleId: saleId, Memo: reason || null, Now: now }
    );
}

async function voidSaleLines(saleId) {
    await query(
        `UPDATE SaleLine SET Status = 'Voided' WHERE SaleId = @SaleId`,
        { SaleId: saleId }
    );
}

async function voidSaleTenders(saleId) {
    await query(
        `UPDATE SaleTender SET Status = 'Voided' WHERE SaleId = @SaleId`,
        { SaleId: saleId }
    );
}

async function revertInventoryItemToActive(inventoryItemId, now) {
    await query(
        `UPDATE InventoryItem
         SET StatusId = @ActiveStatusId, StatusUpdatedDT = @Now, UpdatedAt = @Now
         WHERE InventoryItemId = @InventoryItemId`,
        { ActiveStatusId: ACTIVE_STATUS_ID, InventoryItemId: inventoryItemId, Now: now }
    );
}

// ─── Receipts ─────────────────────────────────────────────────────────────────

async function getReceiptContent(saleId) {
    const result = await query(
        `SELECT SaleId, ReceiptContent FROM Sale WHERE SaleId = @SaleId AND IsDeleted = 0`,
        { SaleId: saleId }
    );
    return result.recordset[0] || null;
}

async function updateSaleReceiptContent(saleId, html) {
    await query(
        `UPDATE Sale SET ReceiptContent = @Html WHERE SaleId = @SaleId`,
        { SaleId: saleId, Html: html }
    );
}

module.exports = {
    ACTIVE_STATUS_ID,
    SOLD_STATUS_ID,
    checkAndClaimInventoryItems,
    revertInventoryItems,
    getNextSaleNumber,
    insertSale,
    insertSaleLine,
    insertSaleTender,
    insertInventoryHistory,
    findSales,
    findSaleById,
    updateSaleVoided,
    voidSaleLines,
    voidSaleTenders,
    revertInventoryItemToActive,
    getReceiptContent,
    updateSaleReceiptContent,
};
