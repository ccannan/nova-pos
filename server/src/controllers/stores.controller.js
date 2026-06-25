// server/src/controllers/stores.controller.js
// HTTP request handlers for store operations.
// Converts between API camelCase and DB PascalCase.

const storeModel = require('../models/store.model');

function toCamelCase(row) {
    if (!row) return null;
    return {
        storeId: row.StoreId,
        storeName: row.StoreName,
        addressLine1: row.AddressLine1,
        addressLine2: row.AddressLine2,
        city: row.City,
        state: row.State,
        postcode: row.Postcode,
        phone: row.Phone,
        email: row.Email,
        isActive: row.IsActive,
        createdAt: row.CreatedAt,
        updatedAt: row.UpdatedAt,
    };
}

function toPascalCase(body) {
    const row = {};
    if (body.storeName !== undefined) row.StoreName = body.storeName;
    if (body.addressLine1 !== undefined) row.AddressLine1 = body.addressLine1;
    if (body.addressLine2 !== undefined) row.AddressLine2 = body.addressLine2;
    if (body.city !== undefined) row.City = body.city;
    if (body.state !== undefined) row.State = body.state;
    if (body.postcode !== undefined) row.Postcode = body.postcode;
    if (body.phone !== undefined) row.Phone = body.phone;
    if (body.email !== undefined) row.Email = body.email;
    if (body.isActive !== undefined) row.IsActive = body.isActive;
    return row;
}

/**
 * GET /api/stores
 */
async function getStores(req, res, next) {
    try {
        const { search, page = '1', limit = '20' } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));

        const result = await storeModel.findStores({
            page: pageNum,
            limit: limitNum,
            search: search ? search.trim() : undefined,
        });

        res.json({
            total: result.total,
            page: pageNum,
            limit: limitNum,
            results: result.results.map(toCamelCase),
        });
    } catch (error) {
        next(error);
    }
}

/**
 * GET /api/stores/:id
 */
async function getStore(req, res, next) {
    try {
        const { id } = req.params;
        const store = await storeModel.findStoreById(id);
        if (!store) {
            return res.status(404).json({ error: 'STORE_NOT_FOUND', message: 'Store not found' });
        }
        res.json(toCamelCase(store));
    } catch (error) {
        next(error);
    }
}

/**
 * POST /api/stores
 */
async function createStore(req, res, next) {
    try {
        const body = req.body;

        if (!body.storeName || !body.storeName.trim()) {
            return res.status(400).json({
                error: 'VALIDATION_FAILED',
                message: 'One or more fields are invalid.',
                fields: { storeName: 'Required.' },
            });
        }

        const store = await storeModel.createStore(toPascalCase(body));
        res.status(201).json(toCamelCase(store));
    } catch (error) {
        next(error);
    }
}

/**
 * PUT /api/stores/:id
 */
async function updateStore(req, res, next) {
    try {
        const { id } = req.params;
        const updates = toPascalCase(req.body);

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                error: 'VALIDATION_FAILED',
                message: 'No valid fields to update.',
            });
        }

        const store = await storeModel.updateStore(id, updates);
        if (!store) {
            return res.status(404).json({ error: 'STORE_NOT_FOUND', message: 'Store not found' });
        }
        res.json(toCamelCase(store));
    } catch (error) {
        next(error);
    }
}

module.exports = { getStores, getStore, createStore, updateStore };