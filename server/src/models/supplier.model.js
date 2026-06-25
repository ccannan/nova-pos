// server/src/models/supplier.model.js
// Supplier data access layer

const { query, insertAndReturn, uuid } = require('./base');

/**
 * Get paginated list of suppliers with optional search
 * @param {Object} options - { search, page, limit }
 * @returns {Promise<Object>} { total, page, results }
 */
async function getSuppliers({ search = '', page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  
  // Base query conditions
  let whereClause = 'WHERE IsActive = 1';
  const params = { offset, limit };
  
  // Add search filter if provided
  if (search.trim()) {
    whereClause += ' AND SupplierName LIKE @search';
    params.search = `%${search.trim()}%`;
  }
  
  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM Supplier ${whereClause}`,
    { search: params.search }
  );
  const total = countResult.recordset[0].total;
  
  // Get paginated results
  const dataResult = await query(
    `SELECT 
      SupplierId,
      SupplierName,
      Email,
      Phone,
      AddressLine1,
      AddressLine2,
      City,
      State,
      Postcode,
      MainContact,
      SecondaryContact,
      LegacyKey,
      IsActive,
      CreatedAt,
      UpdatedAt
    FROM Supplier 
    ${whereClause}
    ORDER BY SupplierName
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY`,
    params
  );
  
  return {
    total,
    page,
    results: dataResult.recordset.map(transformSupplierForApi)
  };
}

/**
 * Get supplier by ID
 * @param {string} id - Supplier ID
 * @returns {Promise<Object|null>} Supplier record or null if not found
 */
async function getSupplierById(id) {
  const result = await query(
    `SELECT 
      SupplierId,
      SupplierName,
      Email,
      Phone,
      AddressLine1,
      AddressLine2,
      City,
      State,
      Postcode,
      MainContact,
      SecondaryContact,
      LegacyKey,
      IsActive,
      CreatedAt,
      UpdatedAt
    FROM Supplier 
    WHERE SupplierId = @id AND IsActive = 1`,
    { id }
  );
  
  return result.recordset[0] ? transformSupplierForApi(result.recordset[0]) : null;
}

/**
 * Create new supplier
 * @param {Object} supplierData - Supplier data from API
 * @returns {Promise<Object>} Created supplier record
 */
async function createSupplier(supplierData) {
  const now = new Date();
  const row = {
    SupplierId: uuid(),
    SupplierName: supplierData.supplierName,
    Email: supplierData.email || null,
    Phone: supplierData.phone || null,
    AddressLine1: supplierData.addressLine1 || null,
    AddressLine2: supplierData.addressLine2 || null,
    City: supplierData.city || null,
    State: supplierData.state || null,
    Postcode: supplierData.postcode || null,
    MainContact: supplierData.mainContact || null,
    SecondaryContact: supplierData.secondaryContact || null,
    LegacyKey: supplierData.legacyKey || null,
    IsActive: 1,
    CreatedAt: now,
    UpdatedAt: now
  };
  
  const created = await insertAndReturn('Supplier', 'SupplierId', row);
  return transformSupplierForApi(created);
}

/**
 * Update existing supplier
 * @param {string} id - Supplier ID
 * @param {Object} supplierData - Updated supplier data from API
 * @returns {Promise<Object|null>} Updated supplier record or null if not found
 */
async function updateSupplier(id, supplierData) {
  const now = new Date();
  
  // Check if supplier exists
  const existing = await getSupplierById(id);
  if (!existing) {
    return null;
  }
  
  // Build update query dynamically based on provided fields
  const updates = [];
  const params = { id };
  
  if (supplierData.supplierName !== undefined) {
    updates.push('SupplierName = @supplierName');
    params.supplierName = supplierData.supplierName;
  }
  if (supplierData.email !== undefined) {
    updates.push('Email = @email');
    params.email = supplierData.email;
  }
  if (supplierData.phone !== undefined) {
    updates.push('Phone = @phone');
    params.phone = supplierData.phone;
  }
  if (supplierData.addressLine1 !== undefined) {
    updates.push('AddressLine1 = @addressLine1');
    params.addressLine1 = supplierData.addressLine1;
  }
  if (supplierData.addressLine2 !== undefined) {
    updates.push('AddressLine2 = @addressLine2');
    params.addressLine2 = supplierData.addressLine2;
  }
  if (supplierData.city !== undefined) {
    updates.push('City = @city');
    params.city = supplierData.city;
  }
  if (supplierData.state !== undefined) {
    updates.push('State = @state');
    params.state = supplierData.state;
  }
  if (supplierData.postcode !== undefined) {
    updates.push('Postcode = @postcode');
    params.postcode = supplierData.postcode;
  }
  if (supplierData.mainContact !== undefined) {
    updates.push('MainContact = @mainContact');
    params.mainContact = supplierData.mainContact;
  }
  if (supplierData.secondaryContact !== undefined) {
    updates.push('SecondaryContact = @secondaryContact');
    params.secondaryContact = supplierData.secondaryContact;
  }
  if (supplierData.legacyKey !== undefined) {
    updates.push('LegacyKey = @legacyKey');
    params.legacyKey = supplierData.legacyKey;
  }
  
  // Always update UpdatedAt
  updates.push('UpdatedAt = @updatedAt');
  params.updatedAt = now;
  
  if (updates.length === 1) { // Only UpdatedAt
    return existing; // No changes
  }
  
  await query(
    `UPDATE Supplier SET ${updates.join(', ')} WHERE SupplierId = @id`,
    params
  );
  
  // Return updated record
  return await getSupplierById(id);
}

/**
 * Transform database record to API format (PascalCase -> camelCase)
 * @param {Object} dbRecord - Raw database record
 * @returns {Object} API-formatted record
 */
function transformSupplierForApi(dbRecord) {
  return {
    supplierId: dbRecord.SupplierId,
    supplierName: dbRecord.SupplierName,
    email: dbRecord.Email,
    phone: dbRecord.Phone,
    addressLine1: dbRecord.AddressLine1,
    addressLine2: dbRecord.AddressLine2,
    city: dbRecord.City,
    state: dbRecord.State,
    postcode: dbRecord.Postcode,
    mainContact: dbRecord.MainContact,
    secondaryContact: dbRecord.SecondaryContact,
    legacyKey: dbRecord.LegacyKey,
    isActive: dbRecord.IsActive,
    createdAt: dbRecord.CreatedAt,
    updatedAt: dbRecord.UpdatedAt
  };
}

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier
};