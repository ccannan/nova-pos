const express = require('express');
const router  = express.Router();
const { createSale, getSales, getSale } = require('../controllers/sales.controller');
const { voidSale }   = require('../controllers/voidSale.controller');
const { getReceipt } = require('../controllers/receipts.controller');

router.post('/',              createSale);
router.get('/',               getSales);
router.get('/:id',            getSale);
router.put('/:id/void',       voidSale);
router.get('/:id/receipt',    getReceipt);

module.exports = router;
