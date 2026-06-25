// server/src/controllers/customers.controller.js
// Customer business logic and request/response handling.
// Model handles its own PascalCase ↔ camelCase conversion.

const customerModel = require('../models/customer.model');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/customers — paginated list with optional search
 */
async function getCustomers(req, res, next) {
  try {
    const { search = '', page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const result = await customerModel.getCustomers({
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
 * GET /api/customers/:id — full detail including contacts
 */
async function getCustomerById(req, res, next) {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Invalid ID format' });
    }
    const customer = await customerModel.getCustomerById(id);
    if (!customer) {
      return res.status(404).json({ error: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/customers — create with optional contacts array
 */
async function createCustomer(req, res, next) {
  try {
    const { lastName, ...optionalFields } = req.body;

    if (!lastName || !lastName.trim()) {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: 'One or more fields are invalid.',
        fields: { lastName: 'Required.' },
      });
    }

    const err = validateCustomerFields(optionalFields);
    if (err) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: err });
    }

    if (optionalFields.contacts) {
      const ce = validateContacts(optionalFields.contacts);
      if (ce) {
        return res.status(400).json({ error: 'VALIDATION_FAILED', message: ce });
      }
    }

    const created = await customerModel.createCustomer({
      lastName: lastName.trim(),
      ...optionalFields,
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/customers/:id — update customer fields
 */
async function updateCustomer(req, res, next) {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Invalid ID format' });
    }

    if (req.body.lastName !== undefined && !req.body.lastName.trim()) {
      return res.status(400).json({
        error: 'VALIDATION_FAILED',
        message: 'One or more fields are invalid.',
        fields: { lastName: 'Required.' },
      });
    }

    const err = validateCustomerFields(req.body);
    if (err) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: err });
    }

    const updated = await customerModel.updateCustomer(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/customers/:id/contacts — add a contact
 */
async function createContact(req, res, next) {
  try {
    const { id: customerId } = req.params;
    if (!UUID_RE.test(customerId)) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Invalid ID format' });
    }

    const err = validateSingleContact(req.body);
    if (err) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: err });
    }

    const customer = await customerModel.getCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'CUSTOMER_NOT_FOUND', message: 'Customer not found' });
    }

    const created = await customerModel.createContact(customerId, req.body);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/customers/:id/contacts/:contactId — update a contact
 */
async function updateContact(req, res, next) {
  try {
    const { id: customerId, contactId } = req.params;
    if (!UUID_RE.test(customerId) || !UUID_RE.test(contactId)) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Invalid ID format' });
    }

    const err = validateContactUpdates(req.body);
    if (err) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: err });
    }

    const updated = await customerModel.updateContact(customerId, contactId, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'CONTACT_NOT_FOUND', message: 'Contact not found' });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/customers/:id/contacts/:contactId — soft delete
 */
async function deleteContact(req, res, next) {
  try {
    const { id: customerId, contactId } = req.params;
    if (!UUID_RE.test(customerId) || !UUID_RE.test(contactId)) {
      return res.status(400).json({ error: 'VALIDATION_FAILED', message: 'Invalid ID format' });
    }

    const deleted = await customerModel.deleteContact(customerId, contactId);
    if (!deleted) {
      return res.status(404).json({ error: 'CONTACT_NOT_FOUND', message: 'Contact not found' });
    }
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
}

// ─── Validation helpers ─────────────────────────────────────────────────────

function validateCustomerFields(fields) {
  const stringFields = ['firstName', 'notes', 'legacyKey'];
  for (const field of stringFields) {
    if (fields[field] !== undefined && fields[field] !== null && typeof fields[field] !== 'string') {
      return `${field} must be a string when provided`;
    }
  }
  return null;
}

function validateContacts(contacts) {
  if (!Array.isArray(contacts)) return 'contacts must be an array when provided';
  for (let i = 0; i < contacts.length; i++) {
    const err = validateSingleContact(contacts[i]);
    if (err) return `contacts[${i}]: ${err}`;
  }
  return null;
}

function validateSingleContact(contact) {
  if (!contact || typeof contact !== 'object') return 'contact must be an object';
  if (!contact.contactType || typeof contact.contactType !== 'string') {
    return 'contactType is required and must be a string';
  }
  const validContactTypes = ['Phone', 'Email', 'Address'];
  if (!validContactTypes.includes(contact.contactType)) {
    return `contactType must be one of: ${validContactTypes.join(', ')}`;
  }
  if (['Phone', 'Email'].includes(contact.contactType)) {
    if (!contact.value || typeof contact.value !== 'string' || !contact.value.trim()) {
      return `value is required for ${contact.contactType} contacts`;
    }
    if (contact.contactType === 'Email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact.value.trim())) {
        return 'value must be a valid email address for Email contacts';
      }
    }
  }
  const optStr = ['label', 'addressLine1', 'addressLine2', 'city', 'state', 'postcode', 'country'];
  for (const f of optStr) {
    if (contact[f] !== undefined && contact[f] !== null && typeof contact[f] !== 'string') {
      return `${f} must be a string when provided`;
    }
  }
  if (contact.isPrimary !== undefined && typeof contact.isPrimary !== 'boolean' && contact.isPrimary !== 0 && contact.isPrimary !== 1) {
    return 'isPrimary must be a boolean or 0/1 when provided';
  }
  return null;
}

function validateContactUpdates(updates) {
  if (!updates || typeof updates !== 'object') return 'updates must be an object';
  if (updates.contactType !== undefined) {
    if (typeof updates.contactType !== 'string') return 'contactType must be a string when provided';
    const valid = ['Phone', 'Email', 'Address'];
    if (!valid.includes(updates.contactType)) return `contactType must be one of: ${valid.join(', ')}`;
  }
  if (updates.value !== undefined && updates.contactType === 'Email') {
    if (typeof updates.value !== 'string' || !updates.value.trim()) return 'value must be a non-empty string for Email contacts';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.value.trim())) return 'value must be a valid email address for Email contacts';
  }
  const optStr = ['label', 'value', 'addressLine1', 'addressLine2', 'city', 'state', 'postcode', 'country'];
  for (const f of optStr) {
    if (updates[f] !== undefined && updates[f] !== null && typeof updates[f] !== 'string') {
      return `${f} must be a string when provided`;
    }
  }
  if (updates.isPrimary !== undefined && typeof updates.isPrimary !== 'boolean' && updates.isPrimary !== 0 && updates.isPrimary !== 1) {
    return 'isPrimary must be a boolean or 0/1 when provided';
  }
  return null;
}

module.exports = {
  getCustomers, getCustomerById, createCustomer, updateCustomer,
  createContact, updateContact, deleteContact,
};