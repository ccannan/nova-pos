const express = require('express');
const router = express.Router();
const { getItems, getItem, createItem, updateItem } = require('../controllers/items.controller');

router.get('/', getItems);
router.get('/:id', getItem);
router.post('/', createItem);
router.put('/:id', updateItem);

module.exports = router;
