const express = require('express');
const router = express.Router();
const { getInventoryItems, getInventoryItem, createInventoryItem, updateInventoryItem } = require('../controllers/inventory.controller');

router.get('/', getInventoryItems);
router.get('/:id', getInventoryItem);
router.post('/', createInventoryItem);
router.put('/:id', updateInventoryItem);

module.exports = router;
