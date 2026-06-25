// server/src/controllers/suppliers.controller.js
// Supplier business logic and request/response handling.
// NOTE: The supplier model handles its own PascalCase ↔ camelCase conversion,
// so this controller passes request data through as-is.

const supplierModel = require('../models/supplier.model');

/**
 * GET /api/suppliers
 */
async function getSuppliers(req, res, next) {
  try {
    const { search = '', page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const result = await supplierModel.getSuppliers({
      search: search.trim(),
      page: pageNum,
      limit: limitNum,
    });

    res.json({
      results: result.results || [],
      total: Number(result.total || 0),
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/suppliers/:id
 */
async function getSupplierById(req, res, next) {
  try {
    const { id } = req.params;
    const supplier = await supplierModel.getSupplierById(id);
    if (!supplier) {
      return res.status(404).json({ error: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });
    }
    res.json(supplier);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/suppliers
 */
async function createSupplier(req, res, next) {
  try {
    const body = req.body;

    if (!body.supplierName || !body.supplierName.trim()) {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: 'One or more fields are invalid.',
        fields: { supplierName: 'Required.' },
      });
    }

    const supplier = await supplierModel.createSupplier(body);
    res.status(201).json(supplier);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/suppliers/:id
 */
async function updateSupplier(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: 'No valid fields to update.',
      });
    }

    const supplier = await supplierModel.updateSupplier(id, updates);
    if (!supplier) {
      return res.status(404).json({ error: 'SUPPLIER_NOT_FOUND', message: 'Supplier not found' });
    }
    res.json(supplier);
  } catch (error) {
    next(error);
  }
}

module.exports = { getSuppliers, getSupplierById, createSupplier, updateSupplier };