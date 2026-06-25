// server/src/routes/customers.js
// Customer API routes

const express = require('express');
const router = express.Router();
const customersController = require('../controllers/customers.controller');

// GET /api/customers - Get paginated list of customers (with optional search)
router.get('/', customersController.getCustomers);

// GET /api/customers/:id - Get customer by ID with full details and contacts
router.get('/:id', customersController.getCustomerById);

// POST /api/customers - Create new customer with optional contacts
router.post('/', customersController.createCustomer);

// PUT /api/customers/:id - Update existing customer
router.put('/:id', customersController.updateCustomer);

// POST /api/customers/:id/contacts - Add contact to customer
router.post('/:id/contacts', customersController.createContact);

// PUT /api/customers/:id/contacts/:contactId - Update existing contact
router.put('/:id/contacts/:contactId', customersController.updateContact);

// DELETE /api/customers/:id/contacts/:contactId - Soft delete contact
router.delete('/:id/contacts/:contactId', customersController.deleteContact);

module.exports = router;