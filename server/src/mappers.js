// server/src/mappers.js
// Shared camelCase ↔ PascalCase converters for API ↔ DB transformation.

/**
 * Generic DB row → camelCase API response.
 * Converts PascalCase column names to camelCase keys.
 */
function toCamelCase(row, fieldMap) {
    if (!row) return null;
    const result = {};
    for (const [apiKey, dbKey] of Object.entries(fieldMap)) {
        result[apiKey] = row[dbKey] !== undefined ? row[dbKey] : null;
    }
    return result;
}

/**
 * Generic API request body → PascalCase for DB INSERT/UPDATE.
 * Only includes keys present in the body.
 */
function toPascalCase(body, fieldMap) {
    const result = {};
    const camelToDb = {};
    for (const [apiKey, dbKey] of Object.entries(fieldMap)) {
        camelToDb[apiKey] = dbKey;
    }
    for (const [key, value] of Object.entries(body)) {
        const dbKey = camelToDb[key];
        if (dbKey && value !== undefined) {
            result[dbKey] = value;
        }
    }
    return result;
}

// ─── Entity field maps ─────────────────────────────────────────────────────

const STORE_FIELDS = {
    storeId: 'StoreId', storeName: 'StoreName',
    addressLine1: 'AddressLine1', addressLine2: 'AddressLine2',
    city: 'City', state: 'State', postcode: 'Postcode',
    phone: 'Phone', email: 'Email',
    isActive: 'IsActive', createdAt: 'CreatedAt', updatedAt: 'UpdatedAt',
};

const SUPPLIER_FIELDS = {
    supplierId: 'SupplierId', supplierName: 'SupplierName',
    email: 'Email', phone: 'Phone',
    addressLine1: 'AddressLine1', addressLine2: 'AddressLine2',
    city: 'City', state: 'State', postcode: 'Postcode',
    mainContact: 'MainContact', secondaryContact: 'SecondaryContact',
    legacyKey: 'LegacyKey',
    isActive: 'IsActive', createdAt: 'CreatedAt', updatedAt: 'UpdatedAt',
};

const CATEGORY_FIELDS = {
    categoryId: 'CategoryId', categoryName: 'CategoryName',
    description: 'Description',
    isActive: 'IsActive', sortOrder: 'SortOrder', createdAt: 'CreatedAt',
};

const ATTRIB_TYPE_FIELDS = {
    attribTypeId: 'AttribTypeId', attribTypeName: 'AttribTypeName',
    description: 'Description',
    isActive: 'IsActive', sortOrder: 'SortOrder', createdAt: 'CreatedAt',
};

const ATTRIB_TYPE_LIST_FIELDS = {
    attribTypeListId: 'AttribTypeListId', attribTypeId: 'AttribTypeId',
    value: 'Value',
    isActive: 'IsActive', sortOrder: 'SortOrder', createdAt: 'CreatedAt',
};

const ITEM_STATUS_FIELDS = {
    itemStatusId: 'ItemStatusId', statusName: 'StatusName',
    description: 'Description',
    isActive: 'IsActive', sortOrder: 'SortOrder', createdAt: 'CreatedAt',
};

const CUSTOMER_FIELDS = {
    customerId: 'CustomerId', firstName: 'FirstName', lastName: 'LastName',
    notes: 'Notes', legacyKey: 'LegacyKey',
    isDeleted: 'IsDeleted', createdAt: 'CreatedAt', updatedAt: 'UpdatedAt',
};

const CONTACT_FIELDS = {
    custContactId: 'CustContactId', customerId: 'CustomerId',
    contactType: 'ContactType', label: 'Label', value: 'Value',
    addressLine1: 'AddressLine1', addressLine2: 'AddressLine2',
    city: 'City', state: 'State', postcode: 'Postcode', country: 'Country',
    isPrimary: 'IsPrimary', isDeleted: 'IsDeleted', createdAt: 'CreatedAt',
};

module.exports = {
    toCamelCase, toPascalCase,
    STORE_FIELDS, SUPPLIER_FIELDS, CATEGORY_FIELDS,
    ATTRIB_TYPE_FIELDS, ATTRIB_TYPE_LIST_FIELDS,
    ITEM_STATUS_FIELDS, CUSTOMER_FIELDS, CONTACT_FIELDS,
};