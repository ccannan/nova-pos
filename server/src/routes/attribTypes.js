// server/src/routes/attribTypes.js
// AttribType and AttribTypeList API routes

const express = require('express');
const router = express.Router();
const attribTypesController = require('../controllers/attribTypes.controller');

// AttribType routes
// GET /api/attrib-types - Get paginated list of AttribTypes (with optional search)
router.get('/', attribTypesController.getAttribTypes);

// GET /api/attrib-types/:id - Get AttribType by ID
router.get('/:id', attribTypesController.getAttribTypeById);

// POST /api/attrib-types - Create new AttribType
router.post('/', attribTypesController.createAttribType);

// PUT /api/attrib-types/:id - Update existing AttribType
router.put('/:id', attribTypesController.updateAttribType);

// AttribTypeList routes
// GET /api/attrib-types/:id/list - Get AttribTypeList entries for an AttribType
router.get('/:id/list', attribTypesController.getAttribTypeLists);

// POST /api/attrib-types/:id/list - Create new AttribTypeList entry
router.post('/:id/list', attribTypesController.createAttribTypeList);

// PUT /api/attrib-types/list/:listId - Update existing AttribTypeList entry
router.put('/list/:listId', attribTypesController.updateAttribTypeList);

// DELETE /api/attrib-types/list/:listId - Soft delete AttribTypeList entry
router.delete('/list/:listId', attribTypesController.deleteAttribTypeList);

module.exports = router;