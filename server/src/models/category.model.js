// server/src/models/category.model.js
// Category data model

const { query, insertAndReturn, uuid } = require('./base');

/**
 * Get all categories with optional search and pagination
 * @param {Object} options - Query options
 * @param {string} [options.name] - Search by category name
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @returns {Promise<Object>} { categories, total, page, pages }
 */
async function getCategories(options = {}) {
    const { name, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params = {};
    
    if (name) {
        whereClause += ' AND CategoryName LIKE @name';
        params.name = `%${name}%`;
    }
    
    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM Category ${whereClause}`;
    const countResult = await query(countQuery, params);
    const total = countResult.recordset[0].total;
    
    // Get paginated results
    const dataQuery = `
        SELECT CategoryId, CategoryName, Description, IsActive, SortOrder, CreatedAt
        FROM Category 
        ${whereClause}
        ORDER BY SortOrder, CategoryName
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;
    
    const result = await query(dataQuery, { 
        ...params, 
        offset, 
        limit 
    });
    
    const pages = Math.ceil(total / limit);
    
    return {
        categories: result.recordset,
        total,
        page,
        pages
    };
}

/**
 * Get a single category by ID
 * @param {string} categoryId - Category UUID
 * @returns {Promise<Object|null>} Category object or null if not found
 */
async function getCategoryById(categoryId) {
    const result = await query(
        'SELECT CategoryId, CategoryName, Description, IsActive, SortOrder, CreatedAt FROM Category WHERE CategoryId = @categoryId',
        { categoryId }
    );
    
    return result.recordset[0] || null;
}

/**
 * Create a new category
 * @param {Object} categoryData - Category data
 * @param {string} categoryData.CategoryName - Category name
 * @param {string} [categoryData.Description] - Category description
 * @param {boolean} [categoryData.IsActive=true] - Whether category is active
 * @param {number} [categoryData.SortOrder] - Sort order
 * @returns {Promise<Object>} Created category
 */
async function createCategory(categoryData) {
    const categoryId = uuid();
    
    const row = {
        CategoryId: categoryId,
        CategoryName: categoryData.CategoryName,
        Description: categoryData.Description || null,
        IsActive: categoryData.IsActive !== undefined ? categoryData.IsActive : true,
        SortOrder: categoryData.SortOrder || null,
        CreatedAt: new Date()
    };
    
    return await insertAndReturn('Category', 'CategoryId', row);
}

/**
 * Update an existing category
 * @param {string} categoryId - Category UUID
 * @param {Object} categoryData - Updated category data
 * @returns {Promise<Object|null>} Updated category or null if not found
 */
async function updateCategory(categoryId, categoryData) {
    // Check if category exists
    const existing = await getCategoryById(categoryId);
    if (!existing) {
        return null;
    }
    
    const updateFields = [];
    const params = { categoryId };
    
    if (categoryData.CategoryName !== undefined) {
        updateFields.push('CategoryName = @CategoryName');
        params.CategoryName = categoryData.CategoryName;
    }
    
    if (categoryData.Description !== undefined) {
        updateFields.push('Description = @Description');
        params.Description = categoryData.Description;
    }
    
    if (categoryData.IsActive !== undefined) {
        updateFields.push('IsActive = @IsActive');
        params.IsActive = categoryData.IsActive;
    }
    
    if (categoryData.SortOrder !== undefined) {
        updateFields.push('SortOrder = @SortOrder');
        params.SortOrder = categoryData.SortOrder;
    }
    
    if (updateFields.length > 0) {
        const updateQuery = `
            UPDATE Category 
            SET ${updateFields.join(', ')}
            WHERE CategoryId = @categoryId
        `;
        
        await query(updateQuery, params);
    }
    
    // Return updated category
    return await getCategoryById(categoryId);
}

/**
 * Check if a category name already exists (for validation)
 * @param {string} categoryName - Category name to check
 * @param {string} [excludeId] - Category ID to exclude from check (for updates)
 * @returns {Promise<boolean>} True if name exists
 */
async function categoryNameExists(categoryName, excludeId = null) {
    let query_text = 'SELECT COUNT(*) as count FROM Category WHERE CategoryName = @categoryName';
    const params = { categoryName };
    
    if (excludeId) {
        query_text += ' AND CategoryId != @excludeId';
        params.excludeId = excludeId;
    }
    
    const result = await query(query_text, params);
    return result.recordset[0].count > 0;
}

module.exports = {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    categoryNameExists
};