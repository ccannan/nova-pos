// client/src/mocks/fixtures.js
//
// Shared mock data objects used by the default MSW handlers and individual
// test files. These shapes must match the response shapes in
// docs/architecture/03-api-contracts.md exactly.

export const STORE = {
  storeId: '20000001-0000-0000-0000-000000000001',
  storeName: 'City Store',
};

export const SUPPLIER = {
  supplierId: 'aaaaaaaa-bbbb-0000-0000-000000000001',
  supplierName: 'Pandora',
};

export const CATEGORY = {
  categoryId: 'cccccccc-0000-0000-0000-000000000001',
  categoryName: 'Ring',
};

export const CUSTOMER = {
  customerId: 'dddddddd-0000-0000-0000-000000000001',
  firstName: 'Jane',
  lastName: 'Smith',
  primaryPhone: '0412 000 000',
  primaryEmail: 'jane@example.com',
};

export const ITEM = {
  itemId: 'eeeeeeee-0000-0000-0000-000000000001',
  designNo: 'PAN-001',
  description: 'Diamond Solitaire Ring',
  categoryId: CATEGORY.categoryId,
  categoryName: 'Ring',
  supplierId: SUPPLIER.supplierId,
  supplierName: 'Pandora',
  retailPrice: 1299.00,
  cost: 650.00,
  isActive: true,
  stockCount: 3,
};

export const INVENTORY_ITEM = {
  inventoryItemId: 'ffffffff-0000-0000-0000-000000000001',
  itemId: ITEM.itemId,
  designNo: 'PAN-001',
  description: 'Diamond Solitaire Ring',
  categoryName: 'Ring',
  supplierName: 'Pandora',
  effectiveRetailPrice: 1299.00,
  storeId: STORE.storeId,
  storeName: 'City Store',
  statusName: 'Active',
  acquisitionDate: '2026-01-15T00:00:00Z',
};

export const SALE = {
  saleId: '11111111-0000-0000-0000-000000000001',
  saleNumber: 42,
  saleDate: '2026-06-13T10:30:00Z',
  storeId: STORE.storeId,
  storeName: 'City Store',
  customerId: CUSTOMER.customerId,
  customerName: 'Jane Smith',
  subTotal: 1299.00,
  discountTotal: 0.00,
  grandTotal: 1299.00,
  status: 'Active',
  memo: '',
  lines: [
    {
      saleLineId: '22222222-0000-0000-0000-000000000001',
      lineNumber: 1,
      inventoryItemId: INVENTORY_ITEM.inventoryItemId,
      description: 'Diamond Solitaire Ring',
      unitPrice: 1299.00,
      discount: 0.00,
      lineTotal: 1299.00,
      status: 'Active',
    },
  ],
  tender: [
    {
      saleTenderId: '33333333-0000-0000-0000-000000000001',
      tenderMethod: 'Cash',
      amount: 1299.00,
      reference: null,
      status: 'Active',
    },
  ],
};

// ATTRIB_TYPE — follows the GET /attrib-types/:id shape (with nested values).
export const ATTRIB_TYPE = {
  attribTypeId: 'a77ab7e0-0000-0000-0000-000000000001',
  attribTypeName: 'metalType',
  description: 'Metal used in the piece',
  isActive: true,
  sortOrder: 1,
  values: [
    {
      attribTypeListId: 'a77ab7e0-1111-0000-0000-000000000001',
      value: '18ct Yellow Gold',
      isActive: true,
      sortOrder: 1,
    },
  ],
};

// ITEM_STATUS — follows the GET /item-status/:id shape.
export const ITEM_STATUS = {
  itemStatusId: '57a70001-0000-0000-0000-000000000001',
  statusName: 'Active',
  description: 'Item is available for sale',
  isActive: true,
  sortOrder: 1,
};
