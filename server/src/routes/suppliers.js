// server/src/routes/suppliers.js
// Supplier API routes

const express = require('express');
const router = express.Router();
const suppliersController = require('../controllers/suppliers.controller');

// GET /api/suppliers - Get paginated list of suppliers (with optional search)
router.get('/', suppliersController.getSuppliers);

// GET /api/suppliers/:id - Get supplier by ID
router.get('/:id', suppliersController.getSupplierById);

// POST /api/suppliers - Create new supplier
router.post('/', suppliersController.createSupplier);

// PUT /api/suppliers/:id - Update existing supplier
router.put('/:id', suppliersController.updateSupplier);

module.exports = router;