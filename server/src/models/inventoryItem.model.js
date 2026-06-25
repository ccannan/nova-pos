const { query, insertAndReturn, uuid } = require('./base');

// Fixed GUID for the 'Active' ItemStatus — set by migration seed.
const ACTIVE_STATUS_ID = '10000001-0000-0000-0000-000000000001';

function toHistStr(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'boolean') return val ? '1' : '0';
    const n = Number(val);
    if (!isNaN(n) && String(val).trim() !== '') return String(n);
    return String(val);
}

const LIST_SELECT = `
    SELECT
        inv.InventoryItemId, inv.ItemId,
        i.DesignNo, i.Description,
        c.CategoryName, s.SupplierName,
        COALESCE(inv.RetailPrice, i.RetailPrice) AS EffectiveRetailPrice,
        inv.StoreId, st.StoreName,
        ist.StatusName,
        inv.AcquisitionDate
    FROM InventoryItem inv
    JOIN Item i ON inv.ItemId = i.ItemId
    JOIN Supplier s ON i.SupplierId = s.SupplierId
    JOIN Category c ON i.CategoryId = c.CategoryId
    JOIN Store st ON inv.StoreId = st.StoreId
    JOIN ItemStatus ist ON inv.StatusId = ist.ItemStatusId
`;

const DETAIL_SELECT = `
    SELECT
        inv.InventoryItemId, inv.ItemId,
        i.DesignNo, i.Description,
        c.CategoryName, s.SupplierName,
        COALESCE(inv.RetailPrice, i.RetailPrice) AS EffectiveRetailPrice,
        COALESCE(inv.Cost, i.Cost) AS EffectiveCost,
        inv.StoreId, st.StoreName,
        ist.StatusName, inv.StatusId,
        inv.AcquisitionDate,
        inv.Notes, inv.LegacyKey,
        inv.RetailPrice AS InstanceRetailPrice,
        inv.Cost AS InstanceCost
    FROM InventoryItem inv
    JOIN Item i ON inv.ItemId = i.ItemId
    JOIN Supplier s ON i.SupplierId = s.SupplierId
    JOIN Category c ON i.CategoryId = c.CategoryId
    JOIN Store st ON inv.StoreId = st.StoreId
    JOIN ItemStatus ist ON inv.StatusId = ist.ItemStatusId
`;

async function findInventoryItems(options = {}) {
    const {
        inventoryItemId, itemId, designNo, categoryId,
        description, storeId, status = 'Active',
        page = 1, limit = 20,
    } = options;
    const offset = (page - 1) * limit;

    const conditions = ['inv.IsDeleted = 0', 'ist.StatusName = @status'];
    const filterParams = { status };

    if (inventoryItemId) {
        conditions.push('inv.InventoryItemId = @InventoryItemId');
        filterParams.InventoryItemId = inventoryItemId;
    }
    if (itemId) {
        conditions.push('inv.ItemId = @ItemId');
        filterParams.ItemId = itemId;
    }
    if (designNo) {
        conditions.push('i.DesignNo = @DesignNo');
        filterParams.DesignNo = designNo;
    }
    if (categoryId) {
        conditions.push('i.CategoryId = @CategoryId');
        filterParams.CategoryId = categoryId;
    }
    if (description) {
        conditions.push('i.Description LIKE @description');
        filterParams.description = `%${description}%`;
    }
    if (storeId) {
        conditions.push('inv.StoreId = @StoreId');
        filterParams.StoreId = storeId;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
        `SELECT COUNT(*) AS total FROM InventoryItem inv
         JOIN Item i ON inv.ItemId = i.ItemId
         JOIN ItemStatus ist ON inv.StatusId = ist.ItemStatusId
         ${where}`,
        filterParams
    );
    const total = parseInt(countResult.recordset[0].total, 10) || 0;

    const dataResult = await query(
        `${LIST_SELECT} ${where}
         ORDER BY inv.AcquisitionDate ASC
         OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
        { ...filterParams, offset, limit }
    );

    return { total, results: dataResult.recordset };
}

async function findInventoryItemById(id) {
    const result = await query(
        `${DETAIL_SELECT} WHERE inv.InventoryItemId = @InventoryItemId AND inv.IsDeleted = 0`,
        { InventoryItemId: id }
    );
    return result.recordset[0] || null;
}

async function createInventoryItem(data) {
    // Validate referenced records exist
    const itemCheck = await query(
        'SELECT ItemId FROM Item WHERE ItemId = @ItemId AND IsActive = 1',
        { ItemId: data.ItemId }
    );
    if (!itemCheck.recordset[0]) {
        const err = new Error('Item not found');
        err.code = 'ITEM_NOT_FOUND';
        throw err;
    }

    const storeCheck = await query(
        'SELECT StoreId FROM Store WHERE StoreId = @StoreId',
        { StoreId: data.StoreId }
    );
    if (!storeCheck.recordset[0]) {
        const err = new Error('Store not found');
        err.code = 'STORE_NOT_FOUND';
        throw err;
    }

    const now = new Date();
    const inventoryItemId = uuid();

    await insertAndReturn('InventoryItem', 'InventoryItemId', {
        InventoryItemId: inventoryItemId,
        ItemId: data.ItemId,
        StoreId: data.StoreId,
        StatusId: ACTIVE_STATUS_ID,
        StatusUpdatedDT: now,
        RetailPrice: data.RetailPrice !== undefined ? data.RetailPrice : null,
        Cost: data.Cost !== undefined ? data.Cost : null,
        AcquisitionDate: data.AcquisitionDate || now,
        Notes: data.Notes || null,
        IsDeleted: 0,
        CreatedAt: now,
        UpdatedAt: now,
    });

    return findInventoryItemById(inventoryItemId);
}

async function updateInventoryItem(id, updates, userId) {
    const existing = await findInventoryItemById(id);
    if (!existing) return null;

    const now = new Date();

    const trackable = ['StatusId', 'RetailPrice', 'Cost', 'StoreId', 'Notes'];
    const historyRows = [];
    const updateFields = [];
    const updateParams = { InventoryItemId: id, UpdatedAt: now };

    for (const col of trackable) {
        if (updates[col] === undefined) continue;
        // For the detail row, StatusId comes from StatusId column (not returned by alias)
        // We stored StatusId in the DETAIL_SELECT; use it here.
        const dbBefore = col === 'StatusId' ? existing.StatusId
            : col === 'RetailPrice' ? existing.InstanceRetailPrice
            : col === 'Cost' ? existing.InstanceCost
            : existing[col];

        const before = toHistStr(dbBefore);
        const after = toHistStr(updates[col]);
        if (before === after) continue;

        historyRows.push({ col, before, after });
        updateFields.push(`${col} = @${col}`);
        updateParams[col] = updates[col];
    }

    if (updateFields.length === 0) return existing;

    // Update StatusUpdatedDT when status changes
    if (updates.StatusId !== undefined) {
        updateFields.push('StatusUpdatedDT = @UpdatedAt');
    }

    updateFields.push('UpdatedAt = @UpdatedAt');
    await query(
        `UPDATE InventoryItem SET ${updateFields.join(', ')} WHERE InventoryItemId = @InventoryItemId`,
        updateParams
    );

    for (const { col, before, after } of historyRows) {
        await insertAndReturn('InventoryHistory', 'InventoryHistoryId', {
            InventoryHistoryId: uuid(),
            InventoryItemId: id,
            ColumnName: col,
            BeforeValue: before,
            AfterValue: after,
            ChangedAt: now,
            UserId: userId || null,
        });
    }

    return findInventoryItemById(id);
}

module.exports = { findInventoryItems, findInventoryItemById, createInventoryItem, updateInventoryItem };
