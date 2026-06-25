// server/src/models/customer.model.js
// Customer data access layer

const { query, insertAndReturn, uuid } = require('./base');

/**
 * Get paginated list of customers with optional search
 * @param {Object} options - { search, page, limit }
 * @returns {Promise<Object>} { total, page, limit, results }
 */
async function getCustomers({ search = '', page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  
  // Base query conditions
  let whereClause = 'WHERE c.IsDeleted = 0';
  const params = { offset, limit };
  
  // Add search filter if provided
  if (search.trim()) {
    whereClause += ` AND (
      c.LastName LIKE @search OR 
      c.FirstName LIKE @search OR
      EXISTS (
        SELECT 1 FROM CustContact cc 
        WHERE cc.CustomerId = c.CustomerId 
        AND cc.IsDeleted = 0 
        AND cc.Value LIKE @search
      )
    )`;
    params.search = `%${search.trim()}%`;
  }
  
  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM Customer c ${whereClause}`,
    { search: params.search }
  );
  const total = countResult.recordset[0].total;
  
  // Get paginated results with primary contacts
  const dataResult = await query(
    `SELECT 
      c.CustomerId,
      c.FirstName,
      c.LastName,
      (
        SELECT TOP 1 cc.Value 
        FROM CustContact cc 
        WHERE cc.CustomerId = c.CustomerId 
        AND cc.ContactType = 'Phone' 
        AND cc.IsDeleted = 0 
        AND cc.IsPrimary = 1
      ) as PrimaryPhone,
      (
        SELECT TOP 1 cc.Value 
        FROM CustContact cc 
        WHERE cc.CustomerId = c.CustomerId 
        AND cc.ContactType = 'Email' 
        AND cc.IsDeleted = 0 
        AND cc.IsPrimary = 1
      ) as PrimaryEmail
    FROM Customer c 
    ${whereClause}
    ORDER BY c.LastName, c.FirstName
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY`,
    params
  );
  
  return {
    total,
    page,
    limit,
    results: dataResult.recordset.map(transformCustomerListForApi)
  };
}

/**
 * Get customer by ID with full details including contacts
 * @param {string} id - Customer ID
 * @returns {Promise<Object|null>} Customer record with contacts or null if not found
 */
async function getCustomerById(id) {
  const customerResult = await query(
    `SELECT 
      CustomerId,
      FirstName,
      LastName,
      Notes,
      LegacyKey,
      IsDeleted,
      CreatedAt,
      UpdatedAt
    FROM Customer 
    WHERE CustomerId = @id AND IsDeleted = 0`,
    { id }
  );
  
  if (!customerResult.recordset[0]) {
    return null;
  }
  
  const customer = customerResult.recordset[0];
  
  // Get contacts
  const contactsResult = await query(
    `SELECT 
      CustContactId,
      CustomerId,
      ContactType,
      Label,
      Value,
      AddressLine1,
      AddressLine2,
      City,
      State,
      Postcode,
      Country,
      IsPrimary,
      IsDeleted,
      CreatedAt
    FROM CustContact 
    WHERE CustomerId = @id AND IsDeleted = 0
    ORDER BY IsPrimary DESC, ContactType, Label`,
    { id }
  );
  
  return {
    ...transformCustomerForApi(customer),
    contacts: contactsResult.recordset.map(transformContactForApi)
  };
}

/**
 * Create new customer
 * @param {Object} customerData - Customer data from API
 * @returns {Promise<Object>} Created customer record with contacts
 */
async function createCustomer(customerData) {
  const now = new Date();
  const customerId = uuid();
  
  const row = {
    CustomerId: customerId,
    FirstName: customerData.firstName || null,
    LastName: customerData.lastName,
    Notes: customerData.notes || null,
    LegacyKey: customerData.legacyKey || null,
    IsDeleted: 0,
    CreatedAt: now,
    UpdatedAt: now
  };
  
  const created = await insertAndReturn('Customer', 'CustomerId', row);
  
  // Create contacts if provided
  const contacts = [];
  if (customerData.contacts && Array.isArray(customerData.contacts)) {
    for (const contactData of customerData.contacts) {
      const contact = await createContact(customerId, contactData);
      contacts.push(contact);
    }
  }
  
  return {
    ...transformCustomerForApi(created),
    contacts
  };
}

/**
 * Update existing customer
 * @param {string} id - Customer ID
 * @param {Object} customerData - Updated customer data from API
 * @returns {Promise<Object|null>} Updated customer record or null if not found
 */
async function updateCustomer(id, customerData) {
  const now = new Date();
  
  // Check if customer exists
  const existing = await getCustomerById(id);
  if (!existing) {
    return null;
  }
  
  // Build update query dynamically based on provided fields
  const updates = [];
  const params = { id };
  
  if (customerData.firstName !== undefined) {
    updates.push('FirstName = @firstName');
    params.firstName = customerData.firstName;
  }
  if (customerData.lastName !== undefined) {
    updates.push('LastName = @lastName');
    params.lastName = customerData.lastName;
  }
  if (customerData.notes !== undefined) {
    updates.push('Notes = @notes');
    params.notes = customerData.notes;
  }
  if (customerData.legacyKey !== undefined) {
    updates.push('LegacyKey = @legacyKey');
    params.legacyKey = customerData.legacyKey;
  }
  
  // Always update UpdatedAt
  updates.push('UpdatedAt = @updatedAt');
  params.updatedAt = now;
  
  if (updates.length === 1) { // Only UpdatedAt
    return existing; // No changes
  }
  
  await query(
    `UPDATE Customer SET ${updates.join(', ')} WHERE CustomerId = @id`,
    params
  );
  
  // Return updated record
  return await getCustomerById(id);
}

/**
 * Create new contact for a customer
 * @param {string} customerId - Customer ID
 * @param {Object} contactData - Contact data from API
 * @returns {Promise<Object>} Created contact record
 */
async function createContact(customerId, contactData) {
  const now = new Date();
  const row = {
    CustContactId: uuid(),
    CustomerId: customerId,
    ContactType: contactData.contactType,
    Label: contactData.label || null,
    Value: contactData.contactType === 'Address' ? null : contactData.value,
    AddressLine1: contactData.addressLine1 || null,
    AddressLine2: contactData.addressLine2 || null,
    City: contactData.city || null,
    State: contactData.state || null,
    Postcode: contactData.postcode || null,
    Country: contactData.country || null,
    IsPrimary: contactData.isPrimary || 0,
    IsDeleted: 0,
    CreatedAt: now
  };
  
  const created = await insertAndReturn('CustContact', 'CustContactId', row);
  return transformContactForApi(created);
}

/**
 * Update existing contact
 * @param {string} customerId - Customer ID
 * @param {string} contactId - Contact ID
 * @param {Object} contactData - Updated contact data from API
 * @returns {Promise<Object|null>} Updated contact record or null if not found
 */
async function updateContact(customerId, contactId, contactData) {
  // Check if contact exists and belongs to customer
  const existingResult = await query(
    `SELECT * FROM CustContact 
     WHERE CustContactId = @contactId 
     AND CustomerId = @customerId 
     AND IsDeleted = 0`,
    { contactId, customerId }
  );
  
  if (!existingResult.recordset[0]) {
    return null;
  }
  
  // Build update query dynamically based on provided fields
  const updates = [];
  const params = { contactId, customerId };
  
  if (contactData.contactType !== undefined) {
    updates.push('ContactType = @contactType');
    params.contactType = contactData.contactType;
  }
  if (contactData.label !== undefined) {
    updates.push('Label = @label');
    params.label = contactData.label;
  }
  if (contactData.value !== undefined) {
    updates.push('Value = @value');
    params.value = contactData.value;
  }
  if (contactData.addressLine1 !== undefined) {
    updates.push('AddressLine1 = @addressLine1');
    params.addressLine1 = contactData.addressLine1;
  }
  if (contactData.addressLine2 !== undefined) {
    updates.push('AddressLine2 = @addressLine2');
    params.addressLine2 = contactData.addressLine2;
  }
  if (contactData.city !== undefined) {
    updates.push('City = @city');
    params.city = contactData.city;
  }
  if (contactData.state !== undefined) {
    updates.push('State = @state');
    params.state = contactData.state;
  }
  if (contactData.postcode !== undefined) {
    updates.push('Postcode = @postcode');
    params.postcode = contactData.postcode;
  }
  if (contactData.country !== undefined) {
    updates.push('Country = @country');
    params.country = contactData.country;
  }
  if (contactData.isPrimary !== undefined) {
    updates.push('IsPrimary = @isPrimary');
    params.isPrimary = contactData.isPrimary;
  }
  
  if (updates.length === 0) {
    return transformContactForApi(existingResult.recordset[0]); // No changes
  }
  
  await query(
    `UPDATE CustContact SET ${updates.join(', ')} 
     WHERE CustContactId = @contactId AND CustomerId = @customerId`,
    params
  );
  
  // Return updated record
  const updatedResult = await query(
    `SELECT * FROM CustContact 
     WHERE CustContactId = @contactId AND CustomerId = @customerId`,
    { contactId, customerId }
  );
  
  return transformContactForApi(updatedResult.recordset[0]);
}

/**
 * Soft delete a contact
 * @param {string} customerId - Customer ID
 * @param {string} contactId - Contact ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function deleteContact(customerId, contactId) {
  const result = await query(
    `UPDATE CustContact 
     SET IsDeleted = 1 
     WHERE CustContactId = @contactId 
     AND CustomerId = @customerId 
     AND IsDeleted = 0`,
    { contactId, customerId }
  );
  
  return result.rowsAffected[0] > 0;
}

/**
 * Transform customer database record to API format (PascalCase -> camelCase)
 * @param {Object} dbRecord - Raw customer database record
 * @returns {Object} API-formatted customer record
 */
function transformCustomerForApi(dbRecord) {
  return {
    customerId: dbRecord.CustomerId,
    firstName: dbRecord.FirstName,
    lastName: dbRecord.LastName,
    notes: dbRecord.Notes,
    legacyKey: dbRecord.LegacyKey,
    isDeleted: dbRecord.IsDeleted === '1' || dbRecord.IsDeleted === 1 || dbRecord.IsDeleted === true,
    createdAt: dbRecord.CreatedAt,
    updatedAt: dbRecord.UpdatedAt
  };
}

/**
 * Transform customer list database record to API format for list view
 * @param {Object} dbRecord - Raw customer database record from list query
 * @returns {Object} API-formatted customer record for list
 */
function transformCustomerListForApi(dbRecord) {
  return {
    customerId: dbRecord.CustomerId,
    firstName: dbRecord.FirstName,
    lastName: dbRecord.LastName,
    primaryPhone: dbRecord.PrimaryPhone,
    primaryEmail: dbRecord.PrimaryEmail
  };
}

/**
 * Transform contact database record to API format (PascalCase -> camelCase)
 * @param {Object} dbRecord - Raw contact database record
 * @returns {Object} API-formatted contact record
 */
function transformContactForApi(dbRecord) {
  return {
    custContactId: dbRecord.CustContactId,
    customerId: dbRecord.CustomerId,
    contactType: dbRecord.ContactType,
    label: dbRecord.Label,
    value: dbRecord.Value,
    addressLine1: dbRecord.AddressLine1,
    addressLine2: dbRecord.AddressLine2,
    city: dbRecord.City,
    state: dbRecord.State,
    postcode: dbRecord.Postcode,
    country: dbRecord.Country,
    isPrimary: dbRecord.IsPrimary === '1' || dbRecord.IsPrimary === 1 || dbRecord.IsPrimary === true,
    isDeleted: dbRecord.IsDeleted === '1' || dbRecord.IsDeleted === 1 || dbRecord.IsDeleted === true,
    createdAt: dbRecord.CreatedAt
  };
}

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  createContact,
  updateContact,
  deleteContact
};