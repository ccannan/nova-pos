const itemModel = require('../models/item.model');

function toCamelCase(row) {
    if (!row) return null;
    const out = {
        itemId: row.ItemId,
        designNo: row.DesignNo,
        description: row.Description,
        categoryId: row.CategoryId,
        categoryName: row.CategoryName,
        supplierId: row.SupplierId,
        supplierName: row.SupplierName,
        retailPrice: row.RetailPrice !== null ? parseFloat(row.RetailPrice) : null,
        cost: row.Cost !== null ? parseFloat(row.Cost) : null,
        isActive: row.IsActive,
    };
    if (row.StockCount !== undefined) {
        out.stockCount = parseInt(row.StockCount, 10);
    }
    if (row.attributes !== undefined) {
        out.attributes = row.attributes.map(a => ({
            itemAttribId: a.ItemAttribId,
            attribTypeId: a.AttribTypeId,
            attribTypeName: a.AttribTypeName,
            attribTypeListId: a.AttribTypeListId,
            attribValue: a.AttribValue,
        }));
    }
    return out;
}

function toPascalCase(body) {
    const out = {};
    if (body.supplierId !== undefined) out.SupplierId = body.supplierId;
    if (body.categoryId !== undefined) out.CategoryId = body.categoryId;
    if (body.designNo !== undefined) out.DesignNo = body.designNo;
    if (body.description !== undefined) out.Description = body.description;
    if (body.retailPrice !== undefined) out.RetailPrice = body.retailPrice;
    if (body.cost !== undefined) out.Cost = body.cost;
    if (body.isActive !== undefined) out.IsActive = body.isActive;
    if (body.attributes !== undefined) {
        out.attributes = body.attributes.map(a => ({
            AttribTypeId: a.attribTypeId,
            AttribTypeListId: a.attribTypeListId !== undefined ? a.attribTypeListId : null,
            AttribValue: a.attribValue,
        }));
    }
    return out;
}

async function getItems(req, res, next) {
    try {
        const { search, supplierId, categoryId, page = '1', limit = '20' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));

        const result = await itemModel.findItems({
            search: search ? search.trim() : undefined,
            supplierId: supplierId || undefined,
            categoryId: categoryId || undefined,
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

async function getItem(req, res, next) {
    try {
        const item = await itemModel.findItemById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'ITEM_NOT_FOUND', message: 'Item not found.' });
        }
        res.json(toCamelCase(item));
    } catch (err) {
        next(err);
    }
}

async function createItem(req, res, next) {
    try {
        const body = req.body;
        const fields = {};

        if (!body.supplierId) fields.supplierId = 'Required.';
        if (!body.categoryId) fields.categoryId = 'Required.';
        if (!body.designNo || !String(body.designNo).trim()) fields.designNo = 'Required.';

        if (body.retailPrice !== undefined && typeof body.retailPrice !== 'number') {
            fields.retailPrice = 'Must be a number.';
        }
        if (body.cost !== undefined && typeof body.cost !== 'number') {
            fields.cost = 'Must be a number.';
        }

        // Validate attributes
        if (Array.isArray(body.attributes)) {
            for (let i = 0; i < body.attributes.length; i++) {
                const a = body.attributes[i];
                if (!a.attribTypeId) fields[`attributes[${i}].attribTypeId`] = 'Required.';
                if (!a.attribValue) fields[`attributes[${i}].attribValue`] = 'Required.';
            }
        }

        if (Object.keys(fields).length > 0) {
            return res.status(400).json({
                error: 'VALIDATION_FAILED',
                message: 'One or more fields are invalid.',
                fields,
            });
        }

        const data = toPascalCase(body);
        let item;
        try {
            item = await itemModel.createItem(data);
        } catch (err) {
            if (err.code === 'DESIGN_EXISTS') {
                return res.status(409).json({
                    error: 'DESIGN_EXISTS',
                    message: 'A design with this supplier and design number already exists.',
                });
            }
            throw err;
        }

        res.status(201).json(toCamelCase(item));
    } catch (err) {
        next(err);
    }
}

async function updateItem(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body;
        const fields = {};

        if (body.retailPrice !== undefined && typeof body.retailPrice !== 'number') {
            fields.retailPrice = 'Must be a number.';
        }
        if (body.cost !== undefined && typeof body.cost !== 'number') {
            fields.cost = 'Must be a number.';
        }

        if (Array.isArray(body.attributes)) {
            for (let i = 0; i < body.attributes.length; i++) {
                const a = body.attributes[i];
                if (!a.attribTypeId) fields[`attributes[${i}].attribTypeId`] = 'Required.';
                if (!a.attribValue) fields[`attributes[${i}].attribValue`] = 'Required.';
            }
        }

        if (Object.keys(fields).length > 0) {
            return res.status(400).json({
                error: 'VALIDATION_FAILED',
                message: 'One or more fields are invalid.',
                fields,
            });
        }

        const updates = toPascalCase(body);
        const userId = req.headers['x-user-id'] || null;

        let item;
        try {
            item = await itemModel.updateItem(id, updates, userId);
        } catch (err) {
            if (err.code === 'DESIGN_EXISTS') {
                return res.status(409).json({
                    error: 'DESIGN_EXISTS',
                    message: 'A design with this supplier and design number already exists.',
                });
            }
            throw err;
        }

        if (!item) {
            return res.status(404).json({ error: 'ITEM_NOT_FOUND', message: 'Item not found.' });
        }
        res.json(toCamelCase(item));
    } catch (err) {
        next(err);
    }
}

module.exports = { getItems, getItem, createItem, updateItem };
