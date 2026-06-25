const { query, insertAndReturn, uuid } = require('./base');

// Convert a raw DB value to a clean string for history storage.
// Money columns come back from sqlcmd as '100.0000' — normalise to '100'.
function toHistStr(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'boolean') return val ? '1' : '0';
    const n = Number(val);
    if (!isNaN(n) && String(val).trim() !== '') return String(n);
    return String(val);
}

async function findItems(options = {}) {
    const { search, supplierId, categoryId, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const conditions = ['i.IsActive = 1'];
    const filterParams = {};

    if (search) {
        conditions.push('(i.Description LIKE @search OR i.DesignNo LIKE @search)');
        filterParams.search = `%${search}%`;
    }
    if (supplierId) {
        conditions.push('i.SupplierId = @SupplierId');
        filterParams.SupplierId = supplierId;
    }
    if (categoryId) {
        conditions.push('i.CategoryId = @CategoryId');
        filterParams.CategoryId = categoryId;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await query(
        `SELECT COUNT(*) AS total FROM Item i ${where}`,
        filterParams
    );
    const total = parseInt(countResult.recordset[0].total, 10) || 0;

    const dataResult = await query(`
        SELECT
            i.ItemId, i.DesignNo, i.Description,
            i.CategoryId, c.CategoryName,
            i.SupplierId, s.SupplierName,
            i.RetailPrice, i.Cost, i.IsActive,
            (SELECT COUNT(*)
             FROM InventoryItem ii
             JOIN ItemStatus ist ON ii.StatusId = ist.ItemStatusId
             WHERE ii.ItemId = i.ItemId
               AND ist.StatusName = 'Active'
               AND ii.IsDeleted = 0) AS StockCount
        FROM Item i
        JOIN Supplier s ON i.SupplierId = s.SupplierId
        JOIN Category c ON i.CategoryId = c.CategoryId
        ${where}
        ORDER BY i.DesignNo
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `, { ...filterParams, offset, limit });

    return { total, results: dataResult.recordset };
}

async function findItemById(id) {
    const itemResult = await query(`
        SELECT
            i.ItemId, i.DesignNo, i.Description,
            i.CategoryId, c.CategoryName,
            i.SupplierId, s.SupplierName,
            i.RetailPrice, i.Cost, i.IsActive
        FROM Item i
        JOIN Supplier s ON i.SupplierId = s.SupplierId
        JOIN Category c ON i.CategoryId = c.CategoryId
        WHERE i.ItemId = @ItemId AND i.IsActive = 1
    `, { ItemId: id });

    const item = itemResult.recordset[0];
    if (!item) return null;

    const attribResult = await query(`
        SELECT
            ia.ItemAttribId, ia.AttribTypeId, at.AttribTypeName,
            ia.AttribTypeListId, ia.AttribValue
        FROM ItemAttrib ia
        JOIN AttribType at ON ia.AttribTypeId = at.AttribTypeId
        WHERE ia.ItemId = @ItemId
    `, { ItemId: id });

    return { ...item, attributes: attribResult.recordset };
}

async function designExists(supplierId, designNo, excludeItemId) {
    const result = await query(
        `SELECT COUNT(*) AS cnt FROM Item
         WHERE SupplierId = @SupplierId AND DesignNo = @DesignNo AND ItemId <> @ExcludeId`,
        { SupplierId: supplierId, DesignNo: designNo, ExcludeId: excludeItemId }
    );
    return parseInt(result.recordset[0].cnt, 10) > 0;
}

async function createItem(data) {
    const { attributes = [] } = data;

    if (await designExists(data.SupplierId, data.DesignNo, '00000000-0000-0000-0000-000000000000')) {
        const err = new Error('Design already exists for this supplier');
        err.code = 'DESIGN_EXISTS';
        throw err;
    }

    const now = new Date();
    const itemId = uuid();

    await insertAndReturn('Item', 'ItemId', {
        ItemId: itemId,
        SupplierId: data.SupplierId,
        CategoryId: data.CategoryId,
        DesignNo: data.DesignNo,
        Description: data.Description || null,
        RetailPrice: data.RetailPrice !== undefined ? data.RetailPrice : null,
        Cost: data.Cost !== undefined ? data.Cost : null,
        IsActive: 1,
        CreatedAt: now,
        UpdatedAt: now,
    });

    for (const attr of attributes) {
        await insertAndReturn('ItemAttrib', 'ItemAttribId', {
            ItemAttribId: uuid(),
            ItemId: itemId,
            AttribTypeId: attr.AttribTypeId,
            AttribTypeListId: attr.AttribTypeListId || null,
            AttribValue: attr.AttribValue,
            CreatedAt: now,
            UpdatedAt: now,
        });
    }

    return findItemById(itemId);
}

async function updateItem(id, updates, userId) {
    const existing = await findItemById(id);
    if (!existing) return null;

    const now = new Date();

    // Conflict check if supplier or designNo is changing
    const newSupplierId = updates.SupplierId !== undefined ? updates.SupplierId : existing.SupplierId;
    const newDesignNo = updates.DesignNo !== undefined ? updates.DesignNo : existing.DesignNo;
    if (updates.SupplierId !== undefined || updates.DesignNo !== undefined) {
        if (await designExists(newSupplierId, newDesignNo, id)) {
            const err = new Error('Design already exists for this supplier');
            err.code = 'DESIGN_EXISTS';
            throw err;
        }
    }

    // Determine which columns changed and build the UPDATE
    const trackable = ['DesignNo', 'Description', 'RetailPrice', 'Cost', 'IsActive', 'SupplierId', 'CategoryId'];
    const historyRows = [];
    const updateFields = [];
    const updateParams = { ItemId: id, UpdatedAt: now };

    for (const col of trackable) {
        if (updates[col] === undefined) continue;
        const before = toHistStr(existing[col]);
        const after = toHistStr(updates[col]);
        if (before === after) continue;

        historyRows.push({ col, before, after });
        updateFields.push(`${col} = @${col}`);
        updateParams[col] = updates[col];
    }

    if (updateFields.length === 0 && updates.attributes === undefined) {
        return existing;
    }

    if (updateFields.length > 0) {
        updateFields.push('UpdatedAt = @UpdatedAt');
        await query(
            `UPDATE Item SET ${updateFields.join(', ')} WHERE ItemId = @ItemId`,
            updateParams
        );
    }

    // Write ItemHistory rows
    for (const { col, before, after } of historyRows) {
        await insertAndReturn('ItemHistory', 'ItemHistoryId', {
            ItemHistoryId: uuid(),
            ItemId: id,
            ColumnName: col,
            BeforeValue: before,
            AfterValue: after,
            ChangedAt: now,
            UserId: userId || null,
        });
    }

    // Cascade RetailPrice change to InventoryHistory for inheriting instances
    const priceChange = historyRows.find(r => r.col === 'RetailPrice');
    if (priceChange) {
        const inheritingResult = await query(
            `SELECT InventoryItemId FROM InventoryItem
             WHERE ItemId = @ItemId AND RetailPrice IS NULL AND IsDeleted = 0`,
            { ItemId: id }
        );
        for (const { InventoryItemId } of inheritingResult.recordset) {
            await insertAndReturn('InventoryHistory', 'InventoryHistoryId', {
                InventoryHistoryId: uuid(),
                InventoryItemId,
                ColumnName: 'EffectiveRetailPrice',
                BeforeValue: priceChange.before,
                AfterValue: priceChange.after,
                ChangedAt: now,
                UserId: userId || null,
            });
        }
    }

    // Replace attribute set if provided
    if (updates.attributes !== undefined) {
        await query('DELETE FROM ItemAttrib WHERE ItemId = @ItemId', { ItemId: id });
        for (const attr of updates.attributes) {
            await insertAndReturn('ItemAttrib', 'ItemAttribId', {
                ItemAttribId: uuid(),
                ItemId: id,
                AttribTypeId: attr.AttribTypeId,
                AttribTypeListId: attr.AttribTypeListId || null,
                AttribValue: attr.AttribValue,
                CreatedAt: now,
                UpdatedAt: now,
            });
        }
    }

    return findItemById(id);
}

module.exports = { findItems, findItemById, createItem, updateItem };
