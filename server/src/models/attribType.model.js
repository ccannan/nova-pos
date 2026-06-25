// server/src/models/attribType.model.js
// AttribType and AttribTypeList data access layer

const { query, insertAndReturn, uuid } = require('./base');

/**
 * Get paginated list of AttribTypes with optional search
 * @param {Object} options - { search, page, limit }
 * @returns {Promise<Object>} { total, page, results }
 */
async function getAttribTypes({ search = '', page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  
  // Base query conditions
  let whereClause = 'WHERE IsActive = 1';
  const params = { offset, limit };
  
  // Add search filter if provided
  if (search.trim()) {
    whereClause += ' AND AttribTypeName LIKE @search';
    params.search = `%${search.trim()}%`;
  }
  
  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM AttribType ${whereClause}`,
    { search: params.search }
  );
  const total = countResult.recordset[0].total;
  
  // Get paginated results
  const dataResult = await query(
    `SELECT 
      AttribTypeId,
      AttribTypeName,
      Description,
      IsActive,
      SortOrder,
      CreatedAt
    FROM AttribType 
    ${whereClause}
    ORDER BY SortOrder, AttribTypeName
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY`,
    params
  );
  
  return {
    total,
    page,
    results: dataResult.recordset.map(transformAttribTypeForApi)
  };
}

/**
 * Get AttribType by ID
 * @param {string} id - AttribType ID
 * @returns {Promise<Object|null>} AttribType record or null if not found
 */
async function getAttribTypeById(id) {
  const result = await query(
    `SELECT 
      AttribTypeId,
      AttribTypeName,
      Description,
      IsActive,
      SortOrder,
      CreatedAt
    FROM AttribType 
    WHERE AttribTypeId = @id AND IsActive = 1`,
    { id }
  );
  
  return result.recordset[0] ? transformAttribTypeForApi(result.recordset[0]) : null;
}

/**
 * Create new AttribType
 * @param {Object} attribTypeData - AttribType data from API
 * @returns {Promise<Object>} Created AttribType record
 */
async function createAttribType(attribTypeData) {
  const now = new Date();
  const row = {
    AttribTypeId: uuid(),
    AttribTypeName: attribTypeData.attribTypeName,
    Description: attribTypeData.description || null,
    IsActive: 1,
    SortOrder: attribTypeData.sortOrder || 0,
    CreatedAt: now
  };
  
  const created = await insertAndReturn('AttribType', 'AttribTypeId', row);
  return transformAttribTypeForApi(created);
}

/**
 * Update existing AttribType
 * @param {string} id - AttribType ID
 * @param {Object} attribTypeData - Updated AttribType data from API
 * @returns {Promise<Object|null>} Updated AttribType record or null if not found
 */
async function updateAttribType(id, attribTypeData) {
  // Check if AttribType exists
  const existing = await getAttribTypeById(id);
  if (!existing) {
    return null;
  }
  
  // Build update query dynamically based on provided fields
  const updates = [];
  const params = { id };
  
  if (attribTypeData.attribTypeName !== undefined) {
    updates.push('AttribTypeName = @attribTypeName');
    params.attribTypeName = attribTypeData.attribTypeName;
  }
  if (attribTypeData.description !== undefined) {
    updates.push('Description = @description');
    params.description = attribTypeData.description;
  }
  if (attribTypeData.sortOrder !== undefined) {
    updates.push('SortOrder = @sortOrder');
    params.sortOrder = attribTypeData.sortOrder;
  }
  
  if (updates.length === 0) {
    return existing; // No changes
  }
  
  await query(
    `UPDATE AttribType SET ${updates.join(', ')} WHERE AttribTypeId = @id`,
    params
  );
  
  // Return updated record
  return await getAttribTypeById(id);
}

/**
 * Get AttribTypeList records for a specific AttribType
 * @param {string} attribTypeId - AttribType ID
 * @returns {Promise<Array>} Array of AttribTypeList records
 */
async function getAttribTypeLists(attribTypeId) {
  const result = await query(
    `SELECT 
      AttribTypeListId,
      AttribTypeId,
      Value,
      IsActive,
      SortOrder,
      CreatedAt
    FROM AttribTypeList 
    WHERE AttribTypeId = @attribTypeId AND IsActive = 1
    ORDER BY SortOrder, Value`,
    { attribTypeId }
  );
  
  return result.recordset.map(transformAttribTypeListForApi);
}

/**
 * Create new AttribTypeList entry
 * @param {string} attribTypeId - Parent AttribType ID
 * @param {Object} listData - AttribTypeList data from API
 * @returns {Promise<Object>} Created AttribTypeList record
 */
async function createAttribTypeList(attribTypeId, listData) {
  const now = new Date();
  const row = {
    AttribTypeListId: uuid(),
    AttribTypeId: attribTypeId,
    Value: listData.value,
    IsActive: 1,
    SortOrder: listData.sortOrder || 0,
    CreatedAt: now
  };
  
  const created = await insertAndReturn('AttribTypeList', 'AttribTypeListId', row);
  return transformAttribTypeListForApi(created);
}

/**
 * Update existing AttribTypeList entry
 * @param {string} listId - AttribTypeList ID
 * @param {Object} listData - Updated AttribTypeList data from API
 * @returns {Promise<Object|null>} Updated AttribTypeList record or null if not found
 */
async function updateAttribTypeList(listId, listData) {
  // Check if AttribTypeList exists
  const existing = await getAttribTypeListById(listId);
  if (!existing) {
    return null;
  }
  
  // Build update query dynamically based on provided fields
  const updates = [];
  const params = { listId };
  
  if (listData.value !== undefined) {
    updates.push('Value = @value');
    params.value = listData.value;
  }
  if (listData.sortOrder !== undefined) {
    updates.push('SortOrder = @sortOrder');
    params.sortOrder = listData.sortOrder;
  }
  
  if (updates.length === 0) {
    return existing; // No changes
  }
  
  await query(
    `UPDATE AttribTypeList SET ${updates.join(', ')} WHERE AttribTypeListId = @listId`,
    params
  );
  
  // Return updated record
  return await getAttribTypeListById(listId);
}

/**
 * Soft delete AttribTypeList entry by setting IsActive = 0
 * @param {string} listId - AttribTypeList ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function deleteAttribTypeList(listId) {
  // Check if AttribTypeList exists
  const existing = await getAttribTypeListById(listId);
  if (!existing) {
    return false;
  }
  
  await query(
    `UPDATE AttribTypeList SET IsActive = 0 WHERE AttribTypeListId = @listId`,
    { listId }
  );
  
  return true;
}

/**
 * Get AttribTypeList by ID
 * @param {string} listId - AttribTypeList ID
 * @returns {Promise<Object|null>} AttribTypeList record or null if not found
 */
async function getAttribTypeListById(listId) {
  const result = await query(
    `SELECT 
      AttribTypeListId,
      AttribTypeId,
      Value,
      IsActive,
      SortOrder,
      CreatedAt
    FROM AttribTypeList 
    WHERE AttribTypeListId = @listId AND IsActive = 1`,
    { listId }
  );
  
  return result.recordset[0] ? transformAttribTypeListForApi(result.recordset[0]) : null;
}

/**
 * Transform AttribType database record to API format (PascalCase -> camelCase)
 * @param {Object} dbRecord - Raw database record
 * @returns {Object} API-formatted record
 */
function transformAttribTypeForApi(dbRecord) {
  return {
    attribTypeId: dbRecord.AttribTypeId,
    attribTypeName: dbRecord.AttribTypeName,
    description: dbRecord.Description,
    isActive: dbRecord.IsActive,
    sortOrder: dbRecord.SortOrder,
    createdAt: dbRecord.CreatedAt
  };
}

/**
 * Transform AttribTypeList database record to API format (PascalCase -> camelCase)
 * @param {Object} dbRecord - Raw database record
 * @returns {Object} API-formatted record
 */
function transformAttribTypeListForApi(dbRecord) {
  return {
    attribTypeListId: dbRecord.AttribTypeListId,
    attribTypeId: dbRecord.AttribTypeId,
    value: dbRecord.Value,
    isActive: dbRecord.IsActive,
    sortOrder: dbRecord.SortOrder,
    createdAt: dbRecord.CreatedAt
  };
}

module.exports = {
  getAttribTypes,
  getAttribTypeById,
  createAttribType,
  updateAttribType,
  getAttribTypeLists,
  createAttribTypeList,
  updateAttribTypeList,
  deleteAttribTypeList
};