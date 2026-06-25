// server/src/routes/itemStatus.js
// ItemStatus API routes

const express = require('express');
const router = express.Router();
const itemStatusController = require('../controllers/itemStatus.controller');

// GET /api/item-status - Get paginated list of item statuses (with optional search)
router.get('/', itemStatusController.getItemStatuses);

// GET /api/item-status/:id - Get item status by ID
router.get('/:id', itemStatusController.getItemStatusById);

// POST /api/item-status - Create new item status
router.post('/', itemStatusController.createItemStatus);

// PUT /api/item-status/:id - Update existing item status
router.put('/:id', itemStatusController.updateItemStatus);

// Note: No DELETE route as specified in requirements

module.exports = router;