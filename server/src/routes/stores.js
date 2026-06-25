// server/src/routes/stores.js
// Express router for store endpoints.

const express = require('express');
const router = express.Router();

const {
    getStores,
    getStore,
    createStore,
    updateStore
} = require('../controllers/stores.controller');

/**
 * GET /api/stores
 * List all stores with optional search and pagination.
 * Query params:
 * - search: string (optional) - Filter by store name
 * - page: number (optional, default: 1) - Page number
 * - limit: number (optional, default: 20, max: 100) - Items per page
 */
router.get('/', getStores);

/**
 * GET /api/stores/:id
 * Get a single store by UUID.
 */
router.get('/:id', getStore);

/**
 * POST /api/stores
 * Create a new store.
 * Body should contain store properties:
 * - StoreName: string (required)
 * - AddressLine1: string (optional)
 * - AddressLine2: string (optional)
 * - City: string (optional)
 * - State: string (optional)
 * - Postcode: string (optional)
 * - Phone: string (optional)
 * - Email: string (optional)
 * - IsActive: boolean (optional, default: true)
 */
router.post('/', createStore);

/**
 * PUT /api/stores/:id
 * Update an existing store.
 * Body can contain any updatable store properties.
 */
router.put('/:id', updateStore);

module.exports = router;