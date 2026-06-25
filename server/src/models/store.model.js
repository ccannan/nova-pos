// server/src/models/store.model.js
// Store model with business logic and database operations.

const { query, insertAndReturn, uuid } = require('./base');

/**
 * Find all stores with optional search and pagination.
 * @param {Object} options - Query options
 * @param {string} [options.search] - Search term for store name
 * @param {number} [options.page=1] - Page number (1-indexed)
 * @param {number} [options.limit=20] - Items per page
 * @returns {Promise<{total: number, results: Object[]}>}
 */
async function findStores(options = {}) {
    const { search, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    let whereClause = '';
    let params = { limit, offset };

    if (search) {
        whereClause = 'WHERE StoreName LIKE @search';
        params.search = `%${search}%`;
    }

    // Get total count
    const countQuery = `
        SELECT COUNT(*) as total
        FROM Store
        ${whereClause}
    `;
    const countResult = await query(countQuery, search ? { search: params.search } : {});
    const total = parseInt(countResult.recordset[0].total, 10) || 0;

    // Get paginated results
    const dataQuery = `
        SELECT *
        FROM Store
        ${whereClause}
        ORDER BY StoreName
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
    `;
    const dataResult = await query(dataQuery, params);

    return {
        total,
        results: dataResult.recordset
    };
}

/**
 * Find a store by ID.
 * @param {string} id - Store UUID
 * @returns {Promise<Object|null>}
 */
async function findStoreById(id) {
    const result = await query(
        'SELECT * FROM Store WHERE StoreId = @id',
        { id }
    );
    return result.recordset[0] || null;
}

/**
 * Create a new store.
 * @param {Object} storeData - Store properties
 * @returns {Promise<Object>} The created store
 */
async function createStore(storeData) {
    const now = new Date();
    const store = {
        StoreId: uuid(),
        StoreName: storeData.StoreName,
        AddressLine1: storeData.AddressLine1 || null,
        AddressLine2: storeData.AddressLine2 || null,
        City: storeData.City || null,
        State: storeData.State || null,
        Postcode: storeData.Postcode || null,
        Phone: storeData.Phone || null,
        Email: storeData.Email || null,
        IsActive: storeData.IsActive !== undefined ? storeData.IsActive : true,
        CreatedAt: now,
        UpdatedAt: now
    };

    return await insertAndReturn('Store', 'StoreId', store);
}

/**
 * Update a store by ID.
 * @param {string} id - Store UUID
 * @param {Object} updates - Store properties to update
 * @returns {Promise<Object|null>} The updated store or null if not found
 */
async function updateStore(id, updates) {
    // Check if store exists
    const existing = await findStoreById(id);
    if (!existing) {
        return null;
    }

    // Build update query dynamically
    const updateFields = [];
    const params = { id };

    const allowedFields = [
        'StoreName', 'AddressLine1', 'AddressLine2', 'City', 
        'State', 'Postcode', 'Phone', 'Email', 'IsActive'
    ];

    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            updateFields.push(`${field} = @${field}`);
            params[field] = updates[field];
        }
    }

    if (updateFields.length === 0) {
        // No valid fields to update, return existing
        return existing;
    }

    // Always update the UpdatedAt timestamp
    updateFields.push('UpdatedAt = @UpdatedAt');
    params.UpdatedAt = new Date();

    const updateQuery = `
        UPDATE Store
        SET ${updateFields.join(', ')}
        WHERE StoreId = @id
    `;

    await query(updateQuery, params);

    // Return the updated store
    return await findStoreById(id);
}

module.exports = {
    findStores,
    findStoreById,
    createStore,
    updateStore
};