// server/src/controllers/categories.controller.js
// Category business logic with API ↔ DB case conversion.

const categoryModel = require('../models/category.model');
const { toCamelCase, CATEGORY_FIELDS } = require('../mappers');

const camelCaseRow = (row) => toCamelCase(row, CATEGORY_FIELDS);

/**
 * GET /api/categories
 */
async function getCategories(req, res, next) {
  try {
    const { search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const result = await categoryModel.getCategories({
      name: search ? search.trim() : undefined,
      page: pageNum,
      limit: limitNum,
    });

    res.json({
      total: Number(result.total || 0),
      page: pageNum,
      limit: limitNum,
      results: (result.categories || []).map(camelCaseRow),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/categories/:id
 */
async function getCategoryById(req, res, next) {
  try {
    const { id } = req.params;
    const category = await categoryModel.getCategoryById(id);
    if (!category) {
      return res.status(404).json({ error: 'CATEGORY_NOT_FOUND', message: 'Category not found' });
    }
    res.json(camelCaseRow(category));
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/categories
 */
async function createCategory(req, res, next) {
  try {
    const { categoryName, description, sortOrder } = req.body;

    if (!categoryName || !categoryName.trim()) {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: 'One or more fields are invalid.',
        fields: { categoryName: 'Required.' },
      });
    }

    // Check for duplicate name
    const exists = await categoryModel.categoryNameExists(categoryName.trim());
    if (exists) {
      return res.status(409).json({
        error: 'Category name already exists',
        message: 'A category with this name already exists.',
      });
    }

    const category = await categoryModel.createCategory({
      CategoryName: categoryName.trim(),
      Description: description || null,
      SortOrder: sortOrder !== undefined ? sortOrder : null,
    });

    res.status(201).json(camelCaseRow(category));
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/categories/:id
 */
async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { categoryName, description, isActive, sortOrder } = req.body;

    const updates = {};
    if (categoryName !== undefined) updates.CategoryName = categoryName;
    if (description !== undefined) updates.Description = description;
    if (isActive !== undefined) updates.IsActive = isActive;
    if (sortOrder !== undefined) updates.SortOrder = sortOrder;

    const category = await categoryModel.updateCategory(id, updates);
    if (!category) {
      return res.status(404).json({ error: 'CATEGORY_NOT_FOUND', message: 'Category not found' });
    }
    res.json(camelCaseRow(category));
  } catch (error) {
    next(error);
  }
}

module.exports = { getCategories, getCategoryById, createCategory, updateCategory };