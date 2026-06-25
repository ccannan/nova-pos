// server/src/controllers/attribTypes.controller.js
// AttribType and AttribTypeList request/response handling.
// Model handles its own PascalCase ↔ camelCase conversion.

const attribTypeModel = require('../models/attribType.model');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/attrib-types
 */
async function getAttribTypes(req, res, next) {
  try {
    const { search = '', page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const result = await attribTypeModel.getAttribTypes({
      search: search.trim(),
      page: pageNum,
      limit: limitNum,
    });

    res.json({ ...result, total: Number(result.total || 0) });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/attrib-types/:id
 */
async function getAttribTypeById(req, res, next) {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Invalid ID format' });
    }
    const attribType = await attribTypeModel.getAttribTypeById(id);
    if (!attribType) {
      return res.status(404).json({ error: 'ATTRIB_TYPE_NOT_FOUND', message: 'Attrib type not found' });
    }
    res.json(attribType);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/attrib-types
 */
async function createAttribType(req, res, next) {
  try {
    const { attribTypeName, description, sortOrder } = req.body;

    if (!attribTypeName || !attribTypeName.trim()) {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: 'One or more fields are invalid.',
        fields: { attribTypeName: 'Required.' },
      });
    }

    // Check for duplicate name
    const exists = await attribTypeModel.getAttribTypes({ search: attribTypeName.trim(), limit: 1 });
    if (exists.results && exists.results.some(r => r.attribTypeName.toLowerCase() === attribTypeName.trim().toLowerCase())) {
      return res.status(409).json({
        error: 'ATTRIB_TYPE_NAME_EXISTS',
        message: 'An attribute type with this name already exists.',
      });
    }

    const created = await attribTypeModel.createAttribType({
      attribTypeName: attribTypeName.trim(),
      description: description || null,
      sortOrder: sortOrder !== undefined ? sortOrder : null,
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/attrib-types/:id
 */
async function updateAttribType(req, res, next) {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Invalid ID format' });
    }

    const { attribTypeName, description, isActive, sortOrder } = req.body;
    const updates = {};
    if (attribTypeName !== undefined) updates.attribTypeName = attribTypeName;
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.isActive = isActive;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    const updated = await attribTypeModel.updateAttribType(id, updates);
    if (!updated) {
      return res.status(404).json({ error: 'ATTRIB_TYPE_NOT_FOUND', message: 'Attrib type not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/attrib-types/:id/lists
 */
async function getAttribTypeLists(req, res, next) {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Invalid ID format' });
    }

    // Verify parent exists
    const parent = await attribTypeModel.getAttribTypeById(id);
    if (!parent) {
      return res.status(404).json({ error: 'ATTRIB_TYPE_NOT_FOUND', message: 'Attrib type not found' });
    }

    const lists = await attribTypeModel.getAttribTypeLists(id);
    res.json({ results: lists || [] });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/attrib-types/:id/lists
 */
async function createAttribTypeList(req, res, next) {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Invalid ID format' });
    }

    const { value, sortOrder } = req.body;
    if (!value || !value.trim()) {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: 'One or more fields are invalid.',
        fields: { value: 'Required.' },
      });
    }

    // Verify parent exists
    const parent = await attribTypeModel.getAttribTypeById(id);
    if (!parent) {
      return res.status(404).json({ error: 'ATTRIB_TYPE_NOT_FOUND', message: 'Attrib type not found' });
    }

    const created = await attribTypeModel.createAttribTypeList(id, {
      value: value.trim(),
      sortOrder: sortOrder !== undefined ? sortOrder : null,
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/attrib-types/lists/:listId
 */
async function updateAttribTypeList(req, res, next) {
  try {
    const { listId } = req.params;
    if (!UUID_RE.test(listId)) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Invalid ID format' });
    }

    const { value, isActive, sortOrder } = req.body;
    const updates = {};
    if (value !== undefined) updates.value = value;
    if (isActive !== undefined) updates.isActive = isActive;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    const updated = await attribTypeModel.updateAttribTypeList(listId, updates);
    if (!updated) {
      return res.status(404).json({ error: 'ATTRIB_TYPE_LIST_NOT_FOUND', message: 'List entry not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/attrib-types/lists/:listId
 */
async function deleteAttribTypeList(req, res, next) {
  try {
    const { listId } = req.params;
    if (!UUID_RE.test(listId)) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Invalid ID format' });
    }

    const deleted = await attribTypeModel.deleteAttribTypeList(listId);
    if (!deleted) {
      return res.status(404).json({ error: 'ATTRIB_TYPE_LIST_NOT_FOUND', message: 'List entry not found' });
    }
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAttribTypes, getAttribTypeById, createAttribType, updateAttribType,
  getAttribTypeLists, createAttribTypeList, updateAttribTypeList, deleteAttribTypeList,
};