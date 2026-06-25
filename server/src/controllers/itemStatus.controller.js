// server/src/controllers/itemStatus.controller.js
// ItemStatus request/response handling.
// Model handles its own PascalCase ↔ camelCase conversion.

const itemStatusModel = require('../models/itemStatus.model');

/**
 * GET /api/item-status
 */
async function getItemStatuses(req, res, next) {
  try {
    const { search = '', page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const result = await itemStatusModel.getItemStatuses({
      search: search.trim(),
      page: pageNum,
      limit: limitNum,
    });

    res.json({
      total: Number(result.total || 0),
      page: pageNum,
      limit: limitNum,
      results: result.results || [],
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/item-status/:id
 */
async function getItemStatusById(req, res, next) {
  try {
    const { id } = req.params;
    const itemStatus = await itemStatusModel.getItemStatusById(id);
    if (!itemStatus) {
      return res.status(404).json({ error: 'ITEM_STATUS_NOT_FOUND', message: 'Item status not found' });
    }
    res.json(itemStatus);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/item-status
 */
async function createItemStatus(req, res, next) {
  try {
    const { statusName, description, sortOrder } = req.body;

    if (!statusName || !statusName.trim()) {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: 'One or more fields are invalid.',
        fields: { statusName: 'Required.' },
      });
    }

    // Check for duplicate status name
    const trimmedStatusName = statusName.trim();
    const nameExists = await itemStatusModel.statusNameExists(trimmedStatusName);
    if (nameExists) {
      return res.status(409).json({
        error: 'DUPLICATE_STATUS_NAME',
        message: 'A status with this name already exists.',
      });
    }

    const created = await itemStatusModel.createItemStatus({
      statusName: trimmedStatusName,
      description: description || null,
      sortOrder: sortOrder !== undefined ? sortOrder : null,
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/item-status/:id
 */
async function updateItemStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { statusName, description, sortOrder } = req.body;

    const updates = {};
    if (statusName !== undefined) updates.statusName = statusName;
    if (description !== undefined) updates.description = description;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    const updated = await itemStatusModel.updateItemStatus(id, updates);
    if (!updated) {
      return res.status(404).json({ error: 'ITEM_STATUS_NOT_FOUND', message: 'Item status not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

module.exports = { getItemStatuses, getItemStatusById, createItemStatus, updateItemStatus };