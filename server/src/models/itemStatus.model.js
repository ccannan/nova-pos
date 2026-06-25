// server/src/models/itemStatus.model.js
// ItemStatus data access layer

const { query, insertAndReturn, uuid } = require('./base');

/**
 * Get paginated list of item statuses with optional search
 * @param {Object} options - { search, page, limit }
 * @returns {Promise<Object>} { total, page, results }
 */
async function getItemStatuses({ search = '', page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  
  // Base query conditions
  let whereClause = 'WHERE IsActive = 1';
  const params = { offset, limit };
  
  // Add search filter if provided
  if (search.trim()) {
    whereClause += ' AND (StatusName LIKE @search OR Description LIKE @search)';
    params.search = `%${search.trim()}%`;
  }
  
  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) as total FROM ItemStatus ${whereClause}`,
    { search: params.search }
  );
  const total = countResult.recordset[0].total;
  
  // Get paginated results
  const dataResult = await query(
    `SELECT 
      ItemStatusId,
      StatusName,
      Description,
      IsActive,
      SortOrder,
      CreatedAt
    FROM ItemStatus 
    ${whereClause}
    ORDER BY SortOrder, StatusName
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY`,
    params
  );
  
  return {
    total,
    page,
    results: dataResult.recordset.map(transformItemStatusForApi)
  };
}

/**
 * Get item status by ID
 * @param {string} id - ItemStatus ID
 * @returns {Promise<Object|null>} ItemStatus record or null if not found
 */
async function getItemStatusById(id) {
  const result = await query(
    `SELECT 
      ItemStatusId,
      StatusName,
      Description,
      IsActive,
      SortOrder,
      CreatedAt
    FROM ItemStatus 
    WHERE ItemStatusId = @id AND IsActive = 1`,
    { id }
  );
  
  return result.recordset[0] ? transformItemStatusForApi(result.recordset[0]) : null;
}

/**
 * Check if status name already exists
 * @param {string} statusName - Status name to check
 * @returns {Promise<boolean>} True if status name exists, false otherwise
 */
async function statusNameExists(statusName) {
  const result = await query(
    `SELECT COUNT(*) as count FROM ItemStatus 
     WHERE StatusName = @statusName AND IsActive = 1`,
    { statusName }
  );
  
  return result.recordset[0].count > 0;
}

/**
 * Create new item status
 * @param {Object} itemStatusData - ItemStatus data from API
 * @returns {Promise<Object>} Created item status record
 */
async function createItemStatus(itemStatusData) {
  const now = new Date();
  
  // Get next sort order if not provided
  let sortOrder = itemStatusData.sortOrder;
  if (sortOrder === undefined || sortOrder === null) {
    const maxSortResult = await query(
      'SELECT ISNULL(MAX(SortOrder), 0) as maxSort FROM ItemStatus'
    );
    sortOrder = maxSortResult.recordset[0].maxSort + 1;
  }
  
  const row = {
    ItemStatusId: uuid(),
    StatusName: itemStatusData.statusName,
    Description: itemStatusData.description || null,
    IsActive: 1,
    SortOrder: sortOrder,
    CreatedAt: now
  };
  
  const created = await insertAndReturn('ItemStatus', 'ItemStatusId', row);
  return transformItemStatusForApi(created);
}

/**
 * Update existing item status
 * @param {string} id - ItemStatus ID
 * @param {Object} itemStatusData - Updated item status data from API
 * @returns {Promise<Object|null>} Updated item status record or null if not found
 */
async function updateItemStatus(id, itemStatusData) {
  // Check if item status exists
  const existing = await getItemStatusById(id);
  if (!existing) {
    return null;
  }
  
  // Build update query dynamically based on provided fields
  const updates = [];
  const params = { id };
  
  if (itemStatusData.statusName !== undefined) {
    updates.push('StatusName = @statusName');
    params.statusName = itemStatusData.statusName;
  }
  if (itemStatusData.description !== undefined) {
    updates.push('Description = @description');
    params.description = itemStatusData.description;
  }
  if (itemStatusData.sortOrder !== undefined) {
    updates.push('SortOrder = @sortOrder');
    params.sortOrder = itemStatusData.sortOrder;
  }
  
  if (updates.length === 0) {
    return existing; // No changes
  }
  
  await query(
    `UPDATE ItemStatus SET ${updates.join(', ')} WHERE ItemStatusId = @id`,
    params
  );
  
  // Return updated record
  return await getItemStatusById(id);
}

/**
 * Transform database record to API format (PascalCase -> camelCase)
 * @param {Object} dbRecord - Raw database record
 * @returns {Object} API-formatted record
 */
function transformItemStatusForApi(dbRecord) {
  return {
    itemStatusId: dbRecord.ItemStatusId,
    statusName: dbRecord.StatusName,
    description: dbRecord.Description,
    isActive: dbRecord.IsActive,
    sortOrder: dbRecord.SortOrder,
    createdAt: dbRecord.CreatedAt
  };
}

module.exports = {
  getItemStatuses,
  getItemStatusById,
  createItemStatus,
  updateItemStatus,
  statusNameExists
};