const invModel = require('../models/inventoryItem.model');

function toCamelCase(row) {
    if (!row) return null;
    return {
        inventoryItemId: row.InventoryItemId,
        itemId: row.ItemId,
        designNo: row.DesignNo,
        description: row.Description,
        categoryName: row.CategoryName,
        supplierName: row.SupplierName,
        effectiveRetailPrice: row.EffectiveRetailPrice !== null ? parseFloat(row.EffectiveRetailPrice) : null,
        storeId: row.StoreId,
        storeName: row.StoreName,
        statusName: row.StatusName,
        acquisitionDate: row.AcquisitionDate,
    };
}

function toDetailCamelCase(row) {
    if (!row) return null;
    return {
        ...toCamelCase(row),
        cost: row.EffectiveCost !== null ? parseFloat(row.EffectiveCost) : null,
        notes: row.Notes !== null ? row.Notes : '',
        legacyKey: row.LegacyKey !== null ? row.LegacyKey : '',
    };
}

function toPascalCase(body) {
    const out = {};
    if (body.statusId !== undefined) out.StatusId = body.statusId;
    if (body.retailPrice !== undefined) out.RetailPrice = body.retailPrice;
    if (body.cost !== undefined) out.Cost = body.cost;
    if (body.storeId !== undefined) out.StoreId = body.storeId;
    if (body.notes !== undefined) out.Notes = body.notes;
    return out;
}

async function getInventoryItems(req, res, next) {
    try {
        const {
            inventoryItemId, itemId, designNo, categoryId,
            description, storeId, status,
            page = '1', limit = '20',
        } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));

        const result = await invModel.findInventoryItems({
            inventoryItemId: inventoryItemId || undefined,
            itemId: itemId || undefined,
            designNo: designNo || undefined,
            categoryId: categoryId || undefined,
            description: description || undefined,
            storeId: storeId || undefined,
            status: status || 'Active',
            page: pageNum,
            limit: limitNum,
        });

        res.json({
            total: result.total,
            page: pageNum,
            limit: limitNum,
            results: result.results.map(toCamelCase),
        });
    } catch (err) {
        next(err);
    }
}

async function getInventoryItem(req, res, next) {
    try {
        const inv = await invModel.findInventoryItemById(req.params.id);
        if (!inv) {
            return res.status(404).json({
                error: 'INVENTORY_ITEM_NOT_FOUND',
                message: 'Inventory item not found.',
            });
        }
        res.json(toDetailCamelCase(inv));
    } catch (err) {
        next(err);
    }
}

async function createInventoryItem(req, res, next) {
    try {
        const body = req.body;
        const fields = {};

        if (!body.itemId) fields.itemId = 'Required.';
        if (!body.storeId) fields.storeId = 'Required.';

        if (Object.keys(fields).length > 0) {
            return res.status(400).json({
                error: 'VALIDATION_FAILED',
                message: 'One or more fields are invalid.',
                fields,
            });
        }

        let inv;
        try {
            inv = await invModel.createInventoryItem({
                ItemId: body.itemId,
                StoreId: body.storeId,
                AcquisitionDate: body.acquisitionDate ? new Date(body.acquisitionDate) : null,
                RetailPrice: body.retailPrice !== undefined ? body.retailPrice : undefined,
                Cost: body.cost !== undefined ? body.cost : undefined,
                Notes: body.notes || null,
            });
        } catch (err) {
            if (err.code === 'ITEM_NOT_FOUND') {
                return res.status(404).json({ error: 'ITEM_NOT_FOUND', message: 'Item not found.' });
            }
            if (err.code === 'STORE_NOT_FOUND') {
                return res.status(404).json({ error: 'STORE_NOT_FOUND', message: 'Store not found.' });
            }
            throw err;
        }

        res.status(201).json(toDetailCamelCase(inv));
    } catch (err) {
        next(err);
    }
}

async function updateInventoryItem(req, res, next) {
    try {
        const { id } = req.params;
        const updates = toPascalCase(req.body);
        const userId = req.headers['x-user-id'] || null;

        const inv = await invModel.updateInventoryItem(id, updates, userId);
        if (!inv) {
            return res.status(404).json({
                error: 'INVENTORY_ITEM_NOT_FOUND',
                message: 'Inventory item not found.',
            });
        }
        res.json(toDetailCamelCase(inv));
    } catch (err) {
        next(err);
    }
}

module.exports = { getInventoryItems, getInventoryItem, createInventoryItem, updateInventoryItem };
