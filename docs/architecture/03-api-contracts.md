# API Contracts — POS
*Pass 3 output · 2026-06-13*

---

## Conventions

**Base URL (dev)**: `http://localhost:3001/api`

All request and response bodies are `application/json` unless noted otherwise.

Authentication is post-MVP. Endpoints are currently open. A placeholder `X-User-Id` header is accepted on all mutation endpoints and written to history table `UserId` columns where present.

### Standard Error Response

```json
{
  "error": "VALIDATION_FAILED",
  "message": "One or more fields are invalid.",
  "fields": {
    "lastName": "Required."
  }
}
```

`fields` is only present for `VALIDATION_FAILED` errors.

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK — read or update succeeded |
| 201 | Created — new resource created |
| 202 | Accepted — entire sale queued (DB unavailable) |
| 207 | Multi-Status — sale written with some operations queued |
| 400 | Validation failure |
| 404 | Resource not found |
| 409 | Conflict — e.g. InventoryItem no longer Active |
| 500 | Unexpected server error |

---

## Module: Customers

### GET /customers

Search customers. Returns active (non-deleted) records only.

**Query params**: `search` (matches LastName, FirstName, or any contact Value), `page` (default: 1), `limit` (default: 20)

**Response 200**:
```json
{
  "total": 42,
  "page": 1,
  "limit": 20,
  "results": [
    {
      "customerId": "uuid",
      "firstName": "Jane",
      "lastName": "Smith",
      "primaryPhone": "0412 000 000",
      "primaryEmail": "jane@example.com"
    }
  ]
}
```

---

### GET /customers/:id

Full customer record including all contacts.

**Response 200**:
```json
{
  "customerId": "uuid",
  "firstName": "Jane",
  "lastName": "Smith",
  "notes": "",
  "contacts": [
    {
      "custContactId": "uuid",
      "contactType": "Phone",
      "label": "Mobile",
      "value": "0412 000 000",
      "isPrimary": true
    },
    {
      "custContactId": "uuid",
      "contactType": "Address",
      "label": "Home",
      "addressLine1": "12 Rose St",
      "addressLine2": null,
      "city": "Melbourne",
      "state": "VIC",
      "postcode": "3000",
      "country": "Australia",
      "isPrimary": true
    }
  ]
}
```

**Errors**: 404 `CUSTOMER_NOT_FOUND`

---

### POST /customers

Create customer. Contacts are optional at creation.

**Request body**:
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "notes": "",
  "contacts": [
    {
      "contactType": "Phone",
      "label": "Mobile",
      "value": "0412 000 000",
      "isPrimary": true
    }
  ]
}
```

**Response 201**: Full customer object (same shape as GET /customers/:id)

**Errors**: 400 `VALIDATION_FAILED` — `lastName` is required

---

### PUT /customers/:id

Update customer fields. Contacts are managed via the sub-resource endpoints below.

**Request body**: Any subset of `firstName`, `lastName`, `notes`

**Response 200**: Updated full customer object

**Errors**: 404, 400

---

### POST /customers/:id/contacts

Add a contact.

**Request body**: A single contact object (same shape as the contacts array above)

**Response 201**: Created contact object

**Errors**: 404 `CUSTOMER_NOT_FOUND`, 400 `VALIDATION_FAILED`

---

### PUT /customers/:id/contacts/:contactId

Update a contact.

**Request body**: Any subset of contact fields

**Response 200**: Updated contact object

**Errors**: 404 `CUSTOMER_NOT_FOUND`, 404 `CONTACT_NOT_FOUND`, 400

---

### DELETE /customers/:id/contacts/:contactId

Soft-deletes a contact (`IsDeleted = 1`).

**Response 200**: `{ "deleted": true }`

**Errors**: 404 `CONTACT_NOT_FOUND`

---

## Module: Items

### GET /items

Search item design templates.

**Query params**: `search` (matches Description, DesignNo), `supplierId`, `categoryId`, `page` (default: 1), `limit` (default: 20)

**Response 200**:
```json
{
  "total": 15,
  "page": 1,
  "limit": 20,
  "results": [
    {
      "itemId": "uuid",
      "designNo": "ABC-001",
      "description": "Diamond Solitaire Ring",
      "categoryId": "uuid",
      "categoryName": "Ring",
      "supplierId": "uuid",
      "supplierName": "Pandora",
      "retailPrice": 1299.00,
      "cost": 650.00,
      "isActive": true,
      "stockCount": 3
    }
  ]
}
```

`stockCount` = count of linked InventoryItems with `StatusName = 'Active'`.

---

### GET /items/:id

Full item detail including attributes.

**Response 200**:
```json
{
  "itemId": "uuid",
  "designNo": "ABC-001",
  "description": "Diamond Solitaire Ring",
  "categoryId": "uuid",
  "categoryName": "Ring",
  "supplierId": "uuid",
  "supplierName": "Pandora",
  "retailPrice": 1299.00,
  "cost": 650.00,
  "isActive": true,
  "attributes": [
    {
      "itemAttribId": "uuid",
      "attribTypeId": "uuid",
      "attribTypeName": "metalType",
      "attribTypeListId": "uuid",
      "attribValue": "18ct Yellow Gold"
    }
  ]
}
```

**Errors**: 404 `ITEM_NOT_FOUND`

---

### POST /items

Create an item design. Attributes are optional at creation.

**Request body**:
```json
{
  "supplierId": "uuid",
  "categoryId": "uuid",
  "designNo": "ABC-001",
  "description": "Diamond Solitaire Ring",
  "retailPrice": 1299.00,
  "cost": 650.00,
  "attributes": [
    {
      "attribTypeId": "uuid",
      "attribTypeListId": "uuid",
      "attribValue": "18ct Yellow Gold"
    }
  ]
}
```

`attribTypeListId` is optional (null for free-text attributes). `attribValue` is always required.

**Response 201**: Full item object

**Errors**: 400 `VALIDATION_FAILED`, 409 `DESIGN_EXISTS` (duplicate SupplierId + DesignNo)

---

### PUT /items/:id

Update item. Triggers `ItemHistory` entries for every changed column. If `retailPrice` or `cost` changes, `InventoryHistory` entries are written for all linked InventoryItem rows that do not have an instance-level price override.

**Request body**: Any subset of item fields. If `attributes` is included, it **replaces** the full attribute set for the item.

**Response 200**: Updated full item object

**Errors**: 404, 400, 409 `DESIGN_EXISTS`

---

## Module: Inventory

### GET /inventory

Search InventoryItems. Primary lookup endpoint for the POS sale screen.

**Query params**:

| Param | Description |
|-------|-------------|
| `inventoryItemId` | Exact match — used for barcode scan |
| `itemId` | All instances of a design |
| `designNo` | All instances matching a design number |
| `categoryId` | All instances in a category |
| `description` | Partial text match on Item.Description |
| `storeId` | Filter by store (defaults to current store) |
| `status` | Filter by status name (default: `Active`) |
| `page` | Default: 1 |
| `limit` | Default: 20 |

Results are ordered by `AcquisitionDate ASC` (FIFO). Staff select from the top of the list; the oldest instances are sold first.

**Sale screen search routing**: The UI determines which param to send based on the input value:
- Input matches UUID format (36-char with hyphens) → send `inventoryItemId` (barcode scan path)
- All other input → send `description` (free-text search path)
- Input matches a short alphanumeric pattern with no spaces → also try `designNo` in parallel and merge results

The server does not need to know which path was taken — it treats each param independently.

**Response 200**:
```json
{
  "total": 3,
  "page": 1,
  "limit": 20,
  "results": [
    {
      "inventoryItemId": "uuid",
      "itemId": "uuid",
      "designNo": "ABC-001",
      "description": "Diamond Solitaire Ring",
      "categoryName": "Ring",
      "supplierName": "Pandora",
      "effectiveRetailPrice": 1299.00,
      "storeId": "uuid",
      "storeName": "City Store",
      "statusName": "Active",
      "acquisitionDate": "2026-01-15T00:00:00Z"
    }
  ]
}
```

`effectiveRetailPrice` = `COALESCE(InventoryItem.RetailPrice, Item.RetailPrice)`

---

### GET /inventory/:id

Single InventoryItem detail.

**Response 200**: Same shape as search result plus `cost`, `notes`, `legacyKey`

**Errors**: 404 `INVENTORY_ITEM_NOT_FOUND`

---

### POST /inventory

Add a new InventoryItem (a new physical instance entering stock).

**Request body**:
```json
{
  "itemId": "uuid",
  "storeId": "uuid",
  "acquisitionDate": "2026-06-13",
  "cost": null,
  "retailPrice": null,
  "notes": ""
}
```

`cost` and `retailPrice` are optional instance overrides. If null, Item template values are inherited. Initial `StatusId` is set to 'Active' by the server.

**Response 201**: Full InventoryItem object

**Errors**: 400, 404 `ITEM_NOT_FOUND`, 404 `STORE_NOT_FOUND`

---

### PUT /inventory/:id

Update an InventoryItem (status, price override, store move, notes).

**Request body**: Any subset of `statusId`, `retailPrice`, `cost`, `storeId`, `notes`

All changed columns are written to `InventoryHistory`.

**Response 200**: Updated InventoryItem object

**Errors**: 404, 400

---

## Module: Sales

### POST /sales

Create a sale. See *Sale Creation — Atomicity & Queue Strategy* for full flow.

**Request body**:
```json
{
  "storeId": "uuid",
  "customerId": "uuid | null",
  "memo": "",
  "lines": [
    {
      "inventoryItemId": "uuid",
      "unitPrice": 1299.00,
      "discount": 0.00
    }
  ],
  "tender": [
    {
      "tenderMethod": "Cash",
      "amount": 1299.00,
      "reference": null
    }
  ]
}
```

Each `inventoryItemId` in `lines` is a distinct InventoryItem instance. Selling two of the same design = two entries in `lines` with two different `inventoryItemId` values (resolved by the client from the GET /inventory search results).

**Response 201** — all writes succeeded:
```json
{
  "saleId": "uuid",
  "saleNumber": 42,
  "status": "Active",
  "grandTotal": 1299.00,
  "receiptHtml": "<html>...</html>",
  "queued": []
}
```

**Response 207** — partial write, some operations queued:
```json
{
  "saleId": "uuid",
  "saleNumber": 42,
  "status": "Active",
  "grandTotal": 1299.00,
  "receiptHtml": "<html>...</html>",
  "queued": ["SaleTender", "InventoryHistory"]
}
```

**Response 202** — total DB unavailability, entire sale queued:
```json
{
  "queued": true,
  "queueRef": "2026-06-13T10-30-00-000Z-uuid.json",
  "message": "Sale has been saved locally and will be submitted when the connection is restored."
}
```

**Errors**:
- 400 `VALIDATION_FAILED`
- 409 `INVENTORY_ITEM_NOT_ACTIVE` — one or more items are no longer Active; response body includes `conflictingIds: ["uuid", ...]`

---

### GET /sales

List sales.

**Query params**: `from`, `to` (ISO dates), `customerId`, `storeId`, `status`, `page` (default: 1), `limit` (default: 20)

**Response 200**:
```json
{
  "total": 150,
  "page": 1,
  "limit": 20,
  "results": [
    {
      "saleId": "uuid",
      "saleNumber": 42,
      "saleDate": "2026-06-13T10:30:00Z",
      "customerName": "Jane Smith",
      "grandTotal": 1299.00,
      "status": "Active",
      "lineCount": 2
    }
  ]
}
```

---

### GET /sales/:id

Full sale detail.

**Response 200**:
```json
{
  "saleId": "uuid",
  "saleNumber": 42,
  "saleDate": "2026-06-13T10:30:00Z",
  "storeId": "uuid",
  "storeName": "City Store",
  "customerId": "uuid",
  "customerName": "Jane Smith",
  "subTotal": 1299.00,
  "discountTotal": 0.00,
  "grandTotal": 1299.00,
  "status": "Active",
  "memo": "",
  "lines": [
    {
      "saleLineId": "uuid",
      "lineNumber": 1,
      "inventoryItemId": "uuid",
      "description": "Diamond Solitaire Ring",
      "unitPrice": 1299.00,
      "discount": 0.00,
      "lineTotal": 1299.00,
      "status": "Active"
    }
  ],
  "tender": [
    {
      "saleTenderId": "uuid",
      "tenderMethod": "Cash",
      "amount": 1299.00,
      "reference": null,
      "status": "Active"
    }
  ]
}
```

**Errors**: 404 `SALE_NOT_FOUND`

---

### PUT /sales/:id/void

Void a sale. Post-MVP: requires authorised role. MVP: open.

**Request body**:
```json
{
  "reason": "Customer changed mind"
}
```

**Response 200**:
```json
{
  "saleId": "uuid",
  "status": "Voided",
  "voidedAt": "2026-06-13T11:00:00Z"
}
```

**Errors**: 404 `SALE_NOT_FOUND`, 409 `SALE_ALREADY_VOIDED`

---

## Module: Receipts

### GET /sales/:id/receipt

Returns the stored HTML receipt. Suitable for iframe display, browser print, or email body.

**Response 200**: `Content-Type: text/html` — raw HTML receipt content

**Errors**: 404 `SALE_NOT_FOUND`, 404 `RECEIPT_NOT_GENERATED` (sale exists but receipt write was queued and not yet processed)

---

## Module: Lookups (Wave 2)

These five modules share a consistent pattern: paginated list, single-record get, create, update. All lookup tables use `IsActive` rather than `IsDeleted` — deactivating a record hides it from normal queries without removing it.

---

### Stores

#### GET /stores
Returns all stores. No pagination — store counts are small.

**Response 200**:
```json
{
  "results": [
    {
      "storeId": "uuid",
      "storeName": "City Store",
      "phone": "03 9000 0000",
      "email": "city@example.com",
      "isActive": true
    }
  ]
}
```

#### GET /stores/:id
**Response 200**: Full store object including all address fields.
**Errors**: 404 `STORE_NOT_FOUND`

#### POST /stores
**Request body**: `storeName` (required), `addressLine1`, `addressLine2`, `city`, `state`, `postcode`, `phone`, `email`
**Response 201**: Full store object.
**Errors**: 400 `VALIDATION_FAILED` (`storeName` required)

#### PUT /stores/:id
**Request body**: Any subset of store fields.
**Response 200**: Updated store object.
**Errors**: 404 `STORE_NOT_FOUND`, 400

---

### Suppliers

#### GET /suppliers
**Query params**: `search` (matches SupplierName), `page` (default: 1), `limit` (default: 20)

**Response 200**:
```json
{
  "total": 12,
  "page": 1,
  "limit": 20,
  "results": [
    {
      "supplierId": "uuid",
      "supplierName": "Pandora",
      "email": "orders@pandora.com",
      "phone": "1800 000 000",
      "mainContact": "Jane Rep",
      "isActive": true
    }
  ]
}
```

#### GET /suppliers/:id
**Response 200**: Full supplier object including all address and contact fields.
**Errors**: 404 `SUPPLIER_NOT_FOUND`

#### POST /suppliers
**Request body**: `supplierName` (required), `email`, `phone`, `addressLine1`, `addressLine2`, `city`, `state`, `postcode`, `mainContact`, `secondaryContact`
**Response 201**: Full supplier object.
**Errors**: 400 `VALIDATION_FAILED` (`supplierName` required)

#### PUT /suppliers/:id
**Request body**: Any subset of supplier fields.
**Response 200**: Updated supplier object.
**Errors**: 404 `SUPPLIER_NOT_FOUND`, 400

---

### Categories

#### GET /categories
Returns all active categories ordered by `SortOrder`, then `CategoryName`.

**Response 200**:
```json
{
  "results": [
    {
      "categoryId": "uuid",
      "categoryName": "Ring",
      "description": "",
      "isActive": true,
      "sortOrder": 1
    }
  ]
}
```

#### GET /categories/:id
**Response 200**: Full category object.
**Errors**: 404 `CATEGORY_NOT_FOUND`

#### POST /categories
**Request body**: `categoryName` (required), `description`, `sortOrder`
**Response 201**: Full category object.
**Errors**: 400 `VALIDATION_FAILED`, 409 `CATEGORY_NAME_EXISTS`

#### PUT /categories/:id
**Request body**: Any subset of category fields.
**Response 200**: Updated category object.
**Errors**: 404 `CATEGORY_NOT_FOUND`, 400, 409 `CATEGORY_NAME_EXISTS`

---

### Attribute Types

#### GET /attrib-types
Returns all active attribute types.

**Response 200**:
```json
{
  "results": [
    {
      "attribTypeId": "uuid",
      "attribTypeName": "metalType",
      "description": "Metal used in the piece",
      "isActive": true,
      "sortOrder": 1
    }
  ]
}
```

#### GET /attrib-types/:id
Returns the attribute type with its full list of predefined values.

**Response 200**:
```json
{
  "attribTypeId": "uuid",
  "attribTypeName": "metalType",
  "description": "Metal used in the piece",
  "isActive": true,
  "values": [
    {
      "attribTypeListId": "uuid",
      "value": "18ct Yellow Gold",
      "isActive": true,
      "sortOrder": 1
    }
  ]
}
```

**Errors**: 404 `ATTRIB_TYPE_NOT_FOUND`

#### POST /attrib-types
**Request body**: `attribTypeName` (required), `description`, `sortOrder`
**Response 201**: Full attrib type object (with empty `values` array).
**Errors**: 400 `VALIDATION_FAILED`, 409 `ATTRIB_TYPE_NAME_EXISTS`

#### PUT /attrib-types/:id
**Request body**: Any subset of attrib type fields. Does not modify values.
**Response 200**: Updated attrib type object.
**Errors**: 404 `ATTRIB_TYPE_NOT_FOUND`, 400, 409 `ATTRIB_TYPE_NAME_EXISTS`

#### POST /attrib-types/:id/values
Add a predefined value to an attribute type list.

**Request body**: `value` (required), `sortOrder`
**Response 201**:
```json
{ "attribTypeListId": "uuid", "attribTypeId": "uuid", "value": "18ct Yellow Gold", "isActive": true, "sortOrder": 1 }
```
**Errors**: 404 `ATTRIB_TYPE_NOT_FOUND`, 400 `VALIDATION_FAILED`

#### PUT /attrib-types/:id/values/:valueId
Update a predefined value (rename or reorder).

**Request body**: Any subset of `value`, `sortOrder`, `isActive`
**Response 200**: Updated value object.
**Errors**: 404 `ATTRIB_TYPE_NOT_FOUND`, 404 `ATTRIB_VALUE_NOT_FOUND`, 400

---

### Item Status

Managed via an admin screen. Seed data is inserted by the migration — do not allow deletion of seed rows.

#### GET /item-status
Returns all statuses ordered by `SortOrder`.

**Response 200**:
```json
{
  "results": [
    {
      "itemStatusId": "uuid",
      "statusName": "Active",
      "description": "Item is available for sale",
      "isActive": true,
      "sortOrder": 1
    }
  ]
}
```

#### GET /item-status/:id
**Response 200**: Full status object.
**Errors**: 404 `ITEM_STATUS_NOT_FOUND`

#### POST /item-status
**Request body**: `statusName` (required), `description`, `sortOrder`
**Response 201**: Full status object.
**Errors**: 400 `VALIDATION_FAILED`, 409 `ITEM_STATUS_NAME_EXISTS`

#### PUT /item-status/:id
**Request body**: Any subset of status fields.
**Response 200**: Updated status object.
**Errors**: 404 `ITEM_STATUS_NOT_FOUND`, 400, 409 `ITEM_STATUS_NAME_EXISTS`

---

## Module: Reports

### GET /reports/sales

Date-range sales report with three detail levels.

**Query params**:

| Param | Values | Default |
|-------|--------|---------|
| `from` | ISO date | required |
| `to` | ISO date | required |
| `detail` | `summary` \| `per-sale` \| `full` | `per-sale` |
| `storeId` | uuid | all stores |
| `format` | `json` \| `csv` | `json` |

When `format=csv`, the response is `Content-Type: text/csv` with a `Content-Disposition: attachment` header. PDF export is handled client-side (browser print of the rendered report).

**Response 200 — summary**:
```json
{
  "from": "2026-06-01",
  "to": "2026-06-13",
  "saleCount": 42,
  "itemCount": 58,
  "subTotal": 45200.00,
  "discountTotal": 1200.00,
  "grandTotal": 44000.00
}
```

**Response 200 — per-sale**:
```json
{
  "from": "2026-06-01",
  "to": "2026-06-13",
  "totals": { "saleCount": 42, "itemCount": 58, "grandTotal": 44000.00 },
  "sales": [
    {
      "saleNumber": 42,
      "saleDate": "2026-06-13",
      "customerName": "Jane Smith",
      "lineCount": 2,
      "grandTotal": 1299.00,
      "status": "Active"
    }
  ]
}
```

**Response 200 — full**: Same as per-sale with each sale object including a `lines` array (same shape as GET /sales/:id lines).

---

## Sale Creation — Atomicity & Queue Strategy

### Validation (pre-write, synchronous)

All validation runs before any DB write is attempted. A single failed check returns **400 VALIDATION_FAILED** and aborts. All reference checks (storeId, customerId, inventoryItemId) are treated as field-level validation failures — they return 400 with a `fields` entry, not 404, because they are validating the sale payload rather than looking up independent resources.

1. `storeId` exists and is active → else 400 `fields.storeId`
2. `customerId` exists and is not soft-deleted, when provided → else 400 `fields.customerId`
3. `lines` is not empty → else 400 `fields.lines`
4. Each `inventoryItemId` in `lines` exists and belongs to `storeId` → else 400 `fields.lines`
5. Each `inventoryItemId` in `lines` has `StatusName = 'Active'` → else 409 `INVENTORY_ITEM_NOT_ACTIVE` (status conflict is the one exception — it returns 409 because the item exists but is in the wrong state)
6. `tender` is not empty → else 400 `fields.tender`
7. Sum of tender `amount` values equals computed `grandTotal` → else 400 `fields.tender`
8. Each `tenderMethod` is a known value → else 400 `fields.tenderMethod`

### Write Sequence

Each step is attempted independently. Failures do not abort subsequent steps — they are captured and written to the queue.

```
Step 1  INSERT Sale                          → fail → entire payload queued; return 202
Step 2  INSERT SaleLines (one per item)      → fail → SaleLine rows queued
Step 3  INSERT SaleTender                    → fail → SaleTender rows queued
Step 4  UPDATE InventoryItem status × N      → fail → InventoryItem updates queued
Step 5  INSERT InventoryHistory × N          → fail → InventoryHistory rows queued
Step 6  Generate receipt HTML                → fail → log warning; receipt generated later from tables
Step 7  UPDATE Sale.ReceiptContent           → fail → queued
```

If Step 1 fails, the entire sale payload is written to a single queue file and 202 is returned. No partial state exists in the DB.

If any subsequent step fails, the sale ID exists in the DB. Return 207 with a `queued` array listing the table names that were deferred.

### Queue File Format

Queue files are written to `server/queue/pending/`.  
Filename: `{ISO-timestamp}-{uuid}.json`

```json
{
  "queueId": "uuid",
  "createdAt": "2026-06-13T10:30:00Z",
  "retryCount": 0,
  "lastAttemptAt": null,
  "operations": [
    {
      "step": "INSERT_SALE_TENDER",
      "table": "SaleTender",
      "operation": "INSERT",
      "data": {
        "SaleTenderId": "uuid",
        "SaleId": "uuid",
        "TenderMethod": "Cash",
        "Amount": 1299.00,
        "Reference": null,
        "CreatedAt": "2026-06-13T10:30:00Z"
      }
    }
  ]
}
```

### Queue Folder Structure

```
server/queue/
├── pending/     ← unprocessed files
├── processed/   ← successfully written (retained for audit)
└── failed/      ← exceeded max retries; requires manual review
```

### Queue Processor Behaviour

- Runs on a configurable timer: `QUEUE_POLL_INTERVAL_MS` in `.env` (default: `30000`)
- On each tick:
  1. Read all `.json` files from `pending/`
  2. For each file: attempt all operations in sequence
  3. **All succeed** → move file to `processed/`
  4. **Any fail** → increment `retryCount`, update `lastAttemptAt`, leave in `pending/`
  5. **`retryCount` > `QUEUE_MAX_RETRIES`** (default: `10`) → move to `failed/`, write alert to server log
- Files in `processed/` are kept for audit trail; a separate periodic job can archive them

---

## Void Sale — Detailed Flow

```
1.  Validate sale exists and Status = 'Active'
2.  UPDATE Sale.Status = 'Voided', UpdatedAt = NOW
3.  UPDATE SaleLine.Status = 'Voided' for all lines on this sale
4.  UPDATE SaleTender.Status = 'Voided' for all tender rows on this sale
5.  For each InventoryItem referenced in the sale lines:
    a. INSERT InventoryHistory: ColumnName='StatusId', BeforeValue='Sold',
       AfterValue='Return Via Void', ChangedAt=NOW
    b. INSERT InventoryHistory: ColumnName='StatusId', BeforeValue='Return Via Void',
       AfterValue='Active', ChangedAt=NOW
    c. UPDATE InventoryItem.StatusId = <Active>, StatusUpdatedDT = NOW
6.  Failed steps follow the same queue strategy as sale creation
```

'Return Via Void' appears in `InventoryHistory` as an intermediate history label only — it is **not** required as a row in the `ItemStatus` table. The InventoryItem ends in 'Active' status with a clear two-step audit trail showing it was returned via a void before being reinstated.

---

## Error Catalogue

### Validation & General

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_FAILED` | 400 | Field-level validation errors; see `fields` object |

### Lookup Resources

| Code | HTTP | Meaning |
|------|------|---------|
| `STORE_NOT_FOUND` | 404 | No store with given ID — returned by GET/PUT `/stores/:id` |
| `SUPPLIER_NOT_FOUND` | 404 | No supplier with given ID |
| `CATEGORY_NOT_FOUND` | 404 | No category with given ID |
| `CATEGORY_NAME_EXISTS` | 409 | A category with that name already exists |
| `ATTRIB_TYPE_NOT_FOUND` | 404 | No attribute type with given ID |
| `ATTRIB_TYPE_NAME_EXISTS` | 409 | An attribute type with that name already exists |
| `ATTRIB_VALUE_NOT_FOUND` | 404 | No attribute list value with given ID, or it belongs to a different AttribType |
| `ITEM_STATUS_NOT_FOUND` | 404 | No item status with given ID |
| `ITEM_STATUS_NAME_EXISTS` | 409 | An item status with that name already exists |

### Domain Resources

| Code | HTTP | Meaning |
|------|------|---------|
| `CUSTOMER_NOT_FOUND` | 404 | No active customer with given ID |
| `CONTACT_NOT_FOUND` | 404 | Contact does not exist or belongs to a different customer |
| `ITEM_NOT_FOUND` | 404 | No item design with given ID |
| `DESIGN_EXISTS` | 409 | SupplierId + DesignNo combination already exists |
| `INVENTORY_ITEM_NOT_FOUND` | 404 | No InventoryItem with given ID |
| `INVENTORY_ITEM_NOT_ACTIVE` | 409 | InventoryItem is not Active; `conflictingIds` in response body |

### Sales

| Code | HTTP | Meaning |
|------|------|---------|
| `SALE_NOT_FOUND` | 404 | No sale with given ID |
| `SALE_ALREADY_VOIDED` | 409 | Sale is already Voided |
| `RECEIPT_NOT_GENERATED` | 404 | Sale exists but ReceiptContent has not yet been written |

### Sale Creation — Validation vs. Not Found

An important distinction applies to POST /sales validation:

- `GET /stores/:id` with an unknown ID → **404** `STORE_NOT_FOUND` (explicit resource lookup)
- POST /sales with an unknown `storeId` in the body → **400** `VALIDATION_FAILED` with `fields.storeId` set

The same rule applies to `customerId` and `inventoryItemId` values in a sale request. They are validated as part of the pre-write validation step, not looked up as independent resources. An invalid reference in a sale payload is a malformed request (400), not a missing resource (404).

---

## Data Model Deltas from Pass 2

The following columns are additions to `02-data-architecture.md` and must be included in the migration scripts.

### Sale — add ReceiptContent

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| ReceiptContent | nvarchar(max) | YES | NULL | HTML receipt snapshot, generated at sale completion |

### SaleLine — add Status

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| Status | nvarchar(20) | NO | 'Active' | 'Active', 'Voided' |

### SaleTender — add Status

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| Status | nvarchar(20) | NO | 'Active' | 'Active', 'Voided' |
