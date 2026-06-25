// server/src/routes/categories.js
// Categories API routes

const express = require('express');
const router = express.Router();

const {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory
} = require('../controllers/categories.controller');

// GET /api/categories - Get all categories with optional search and pagination
router.get('/', getCategories);

// GET /api/categories/:id - Get a single category by ID
router.get('/:id', getCategoryById);

// POST /api/categories - Create a new category
router.post('/', createCategory);

// PUT /api/categories/:id - Update an existing category
router.put('/:id', updateCategory);

// Note: DELETE is not implemented as per requirements

module.exports = router;