// tests/helpers/seeds.js
//
// Seed + teardown helpers for the backend test suite.
//
// Every seed helper:
//   - accepts a partial `overrides` object
//   - merges it over safe defaults
//   - INSERTs a single row into the NovaPosTEST database
//   - returns the created row exactly as it exists in the DB (including
//     server-generated columns such as the PK and CreatedAt) so tests can
//     reference real IDs in assertions.
//
// clearAll() deletes all rows in reverse foreign-key order. It uses DELETE
// (not TRUNCATE) because FK constraints prevent TRUNCATE on referenced tables.
// It does NOT drop the schema or remove the migration-seeded ItemStatus /
// default Store rows — those are re-created by migrations, not by tests.

const { randomUUID } = require('crypto');
const db = require('./db-test');
const { STATUS, DEFAULT_STORE_ID } = require('./constants');

// ─── helpers ────────────────────────────────────────────────────────────────

function uuid() {
  return randomUUID();
}

/**
 * Insert a row and return it by re-selecting on its PK.
 * @param {string} table
 * @param {string} pkColumn
 * @param {Object} row  fully-resolved column → value map
 * @returns {Promise<Object>} the inserted row from the DB
 */
async function insertAndReturn(table, pkColumn, row) {
  const columns = Object.keys(row);
  const colList = columns.join(', ');
  const valList = columns.map((c) => `@${c}`).join(', ');
  await db.query(
    `INSERT INTO ${table} (${colList}) VALUES (${valList})`,
    row
  );
  const res = await db.query(
    `SELECT * FROM ${table} WHERE ${pkColumn} = @pk`,
    { pk: row[pkColumn] }
  );
  return res.recordset[0];
}

// ─── Store ────────────────────────────────────────────────────────────────

async function seedStore(overrides = {}) {
  const row = {
    StoreId: uuid(),
    StoreName: 'Test Store',
    IsActive: 1,
    ...overrides,
  };
  return insertAndReturn('Store', 'StoreId', row);
}

// ─── Supplier ─────────────────────────────────────────────────────────────

async function seedSupplier(overrides = {}) {
  const row = {
    SupplierId: uuid(),
    SupplierName: 'Test Supplier',
    IsActive: 1,
    ...overrides,
  };
  return insertAndReturn('Supplier', 'SupplierId', row);
}

// ─── Category ─────────────────────────────────────────────────────────────

async function seedCategory(overrides = {}) {
  const row = {
    CategoryId: uuid(),
    CategoryName: `Ring-${uuid().slice(0, 8)}`,
    IsActive: 1,
    ...overrides,
  };
  return insertAndReturn('Category', 'CategoryId', row);
}

// ─── AttribType ───────────────────────────────────────────────────────────

async function seedAttribType(overrides = {}) {
  const row = {
    AttribTypeId: uuid(),
    AttribTypeName: `metalType-${uuid().slice(0, 8)}`,
    IsActive: 1,
    ...overrides,
  };
  return insertAndReturn('AttribType', 'AttribTypeId', row);
}

// ─── AttribTypeList (requires AttribTypeId) ───────────────────────────────

async function seedAttribTypeList(overrides = {}) {
  let attribTypeId = overrides.AttribTypeId;
  if (!attribTypeId) {
    const at = await seedAttribType();
    attribTypeId = at.AttribTypeId;
  }
  const row = {
    AttribTypeListId: uuid(),
    AttribTypeId: attribTypeId,
    Value: '18ct Yellow Gold',
    IsActive: 1,
    ...overrides,
  };
  return insertAndReturn('AttribTypeList', 'AttribTypeListId', row);
}

// ─── Customer ─────────────────────────────────────────────────────────────

async function seedCustomer(overrides = {}) {
  const row = {
    CustomerId: uuid(),
    FirstName: 'Jane',
    LastName: 'Smith',
    IsDeleted: 0,
    ...overrides,
  };
  return insertAndReturn('Customer', 'CustomerId', row);
}

// ─── CustContact (requires CustomerId) ────────────────────────────────────

async function seedCustContact(overrides = {}) {
  let customerId = overrides.CustomerId;
  if (!customerId) {
    const c = await seedCustomer();
    customerId = c.CustomerId;
  }
  const row = {
    CustContactId: uuid(),
    CustomerId: customerId,
    ContactType: 'Phone',
    Label: 'Mobile',
    Value: '0412 000 000',
    IsPrimary: 1,
    IsDeleted: 0,
    ...overrides,
  };
  return insertAndReturn('CustContact', 'CustContactId', row);
}

// ─── Item (requires SupplierId, CategoryId) ───────────────────────────────

async function seedItem(overrides = {}) {
  let supplierId = overrides.SupplierId;
  let categoryId = overrides.CategoryId;
  if (!supplierId) supplierId = (await seedSupplier()).SupplierId;
  if (!categoryId) categoryId = (await seedCategory()).CategoryId;
  const row = {
    ItemId: uuid(),
    SupplierId: supplierId,
    CategoryId: categoryId,
    DesignNo: `ABC-${uuid().slice(0, 8)}`,
    Description: 'Diamond Solitaire Ring',
    RetailPrice: 1299.0,
    Cost: 650.0,
    IsActive: 1,
    ...overrides,
  };
  return insertAndReturn('Item', 'ItemId', row);
}

// ─── InventoryItem (requires ItemId, StoreId, StatusId) ───────────────────

async function seedInventoryItem(overrides = {}) {
  let itemId = overrides.ItemId;
  if (!itemId) itemId = (await seedItem()).ItemId;
  const row = {
    InventoryItemId: uuid(),
    ItemId: itemId,
    StoreId: overrides.StoreId || DEFAULT_STORE_ID,
    StatusId: overrides.StatusId || STATUS.ACTIVE,
    StatusUpdatedDT: new Date(),
    RetailPrice: null,
    Cost: null,
    AcquisitionDate: new Date('2026-01-15T00:00:00Z'),
    IsDeleted: 0,
    ...overrides,
  };
  return insertAndReturn('InventoryItem', 'InventoryItemId', row);
}

// ─── Sale (requires StoreId; CustomerId optional) ─────────────────────────

async function seedSale(overrides = {}) {
  const row = {
    SaleId: uuid(),
    StoreId: overrides.StoreId || DEFAULT_STORE_ID,
    CustomerId: overrides.CustomerId || null,
    CustomerName: overrides.CustomerName || null,
    SaleNumber: overrides.SaleNumber || Math.floor(Math.random() * 1000000),
    SaleDate: new Date(),
    SubTotal: 1299.0,
    DiscountTotal: 0.0,
    GrandTotal: 1299.0,
    Status: 'Active',
    IsDeleted: 0,
    ...overrides,
  };
  return insertAndReturn('Sale', 'SaleId', row);
}

// ─── SaleLine (requires SaleId, InventoryItemId) ──────────────────────────

async function seedSaleLine(overrides = {}) {
  let saleId = overrides.SaleId;
  let inventoryItemId = overrides.InventoryItemId;
  if (!saleId) saleId = (await seedSale()).SaleId;
  if (!inventoryItemId) inventoryItemId = (await seedInventoryItem()).InventoryItemId;
  const row = {
    SaleLineId: uuid(),
    SaleId: saleId,
    LineNumber: 1,
    InventoryItemId: inventoryItemId,
    Description: 'Diamond Solitaire Ring',
    UnitPrice: 1299.0,
    Discount: 0.0,
    LineTotal: 1299.0,
    Status: 'Active',
    IsDeleted: 0,
    ...overrides,
  };
  return insertAndReturn('SaleLine', 'SaleLineId', row);
}

// ─── SaleTender (requires SaleId) ─────────────────────────────────────────

async function seedSaleTender(overrides = {}) {
  let saleId = overrides.SaleId;
  if (!saleId) saleId = (await seedSale()).SaleId;
  const row = {
    SaleTenderId: uuid(),
    SaleId: saleId,
    TenderMethod: 'Cash',
    Amount: 1299.0,
    Reference: null,
    Status: 'Active',
    ...overrides,
  };
  return insertAndReturn('SaleTender', 'SaleTenderId', row);
}

// ─── clearAll — delete in reverse FK order ────────────────────────────────

async function clearAll() {
  // Order matters: children before parents. Migration-seeded ItemStatus and
  // the default Store are preserved (we only delete test-created Store rows
  // other than the default).
  const tables = [
    'SaleTender',
    'SaleLine',
    'Sale',
    'InventoryHistory',
    'InventoryItem',
    'ItemHistory',
    'ItemAttrib',
    'Item',
    'CustContact',
    'Customer',
    'AttribTypeList',
    'AttribType',
    'Category',
    'Supplier',
  ];
  for (const t of tables) {
    await db.query(`DELETE FROM ${t}`);
  }
  // Remove any test Store rows but keep the migration-seeded default store.
  await db.query('DELETE FROM Store WHERE StoreId <> @keep', {
    keep: DEFAULT_STORE_ID,
  });
}

module.exports = {
  seedStore,
  seedSupplier,
  seedCategory,
  seedAttribType,
  seedAttribTypeList,
  seedCustomer,
  seedCustContact,
  seedItem,
  seedInventoryItem,
  seedSale,
  seedSaleLine,
  seedSaleTender,
  clearAll,
};
