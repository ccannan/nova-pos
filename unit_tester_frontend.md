# Frontend Unit Tester Bootstrap — POS

> Entry point for the Frontend Unit Tester Agent on the POS project.

## Entry

When you see "Begin C:\repos\pos\unit_tester_frontend.md", do the following in order:

1. Load persona: read `C:\repos\agents\unit_tester_frontend.md`
2. Load project context: read `C:\repos\pos\AGENTS.md`
3. Load API contracts: read `C:\repos\pos\docs\architecture\03-api-contracts.md`
4. Load context & scope: read `C:\repos\pos\docs\architecture\01-context-and-scope.md`
5. Load module inventory: read `C:\repos\pos\docs\inventory.md`
6. Begin test generation per the persona's Session Protocol

---

## Tech Stack

| Concern | Tool | Notes |
|---------|------|-------|
| Test runner | **Vitest** | `vite.config.js` at `client/` root; `environment: 'jsdom'` |
| Component rendering | **React Testing Library** | `@testing-library/react` |
| User interaction | **@testing-library/user-event** | Always use `userEvent.setup()`, not `fireEvent` |
| API mocking | **MSW** (Mock Service Worker) | v2 syntax: `http.get(...)`, `HttpResponse.json(...)` |
| Assertions | `@testing-library/jest-dom` | Extended matchers: `toBeInTheDocument`, `toBeDisabled`, etc. |
| Routing | **React Router v6** | Wrap components in `<MemoryRouter>` for testing |

Configure Vitest globals in `vite.config.js`:
```javascript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./src/test-setup.js']  // imports @testing-library/jest-dom
}
```

---

## MSW Setup

MSW handlers live in `client/src/mocks/handlers.js`. The test server is created per test file using `setupServer(...handlers)`. Default handlers return happy-path responses matching the shapes in `03-api-contracts.md`. Individual tests override with `server.use(...)` for error and edge-case scenarios.

Default handler base URL: `/api` (same origin — no need for absolute URLs in tests).

---

## Mock Data Constants

Define in `client/src/mocks/fixtures.js`. These are the test data objects used in MSW responses. They must match the response shapes in the API contracts exactly.

```javascript
// client/src/mocks/fixtures.js

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
    }
  ],
  tender: [
    {
      saleTenderId: '33333333-0000-0000-0000-000000000001',
      tenderMethod: 'Cash',
      amount: 1299.00,
      reference: null,
      status: 'Active',
    }
  ]
};
```

---

## POS-Specific Test Scenarios

These scenarios must be covered in addition to the standard taxonomy dimensions. They represent the critical user workflows in the POS system.

### Sale Screen — Item Search and Line Building

The sale screen is the most-used and highest-risk UI in the system.

**Scenario: Search by description and add one item to sale**
1. Render the sale screen
2. User types a description in the item search field
3. Assert: GET /api/inventory called with `description` param matching the typed value
4. Mock returns one InventoryItem
5. User clicks "Add to Sale" on the result
6. Assert: a sale line row appears showing the item description and price
7. Assert: the InventoryItemId from the mock is associated with the line (e.g., in a data attribute or form value)

**Scenario: Add two instances of the same design (buying 2 of 3 in stock)**
Mock GET /api/inventory to return three InventoryItems with the same designNo but different inventoryItemIds and acquisitionDates.
User adds the first result, then the second result.
Assert: two separate sale lines exist, each showing a distinct inventoryItemId.
Assert: the two lines have different inventoryItemIds — the system must not duplicate the same instance.

**Scenario: Item scan via InventoryItemId**
User types or scans a value that matches an inventoryItemId exactly.
Assert: GET /api/inventory called with `inventoryItemId` param (not `description`).
Assert: the exact matching item is added to the sale line.

**Scenario: Sale line removed**
User adds an item, then clicks the remove button on the line.
Assert: the line is removed from the display.
Assert: POST /api/sales is NOT called during this interaction.

### Sale Screen — Tender and Completion

**Scenario: Cash tender entry and change calculation**
User has one sale line for $1,299.00.
User enters $1,500.00 in the cash tender field.
Assert: change due of $201.00 is displayed before the sale is completed.

**Scenario: Tender amount must equal grand total**
User enters a tender amount less than the grand total.
User clicks Complete Sale.
Assert: POST /api/sales is not called.
Assert: a validation message is visible indicating the tender amount is insufficient.

**Scenario: Successful sale completion — 201 response**
Mock POST /api/sales to return 201 with `queued: []`.
User completes a valid sale.
Assert: the sale screen clears or navigates to a receipt/confirmation view.
Assert: no warning message is visible.

**Scenario: Partial write warning — 207 response**
Mock POST /api/sales to return 207 with `queued: ['SaleTender']`.
User completes a valid sale.
Assert: a warning message is visible indicating some data is queued for processing.
Assert: the user is not blocked — the sale is shown as completed.

**Scenario: InventoryItem conflict — 409 response**
Mock POST /api/sales to return 409 `INVENTORY_ITEM_NOT_ACTIVE`.
User completes the sale.
Assert: an error message is visible explaining that one or more items are no longer available.
Assert: the sale lines remain visible so the user can correct the order.

### Customer Search and Selection

**Scenario: Customer search populates results**
User types at least 2 characters in the customer search field.
Assert: GET /api/customers called with `search` param.
Results appear in a dropdown or list.

**Scenario: Customer selected and attached to sale**
User selects a customer from search results.
Assert: the customer's name is displayed in the sale header.
Assert: the customerId will be included in the POST /api/sales payload (verify via request capture).

**Scenario: Walk-in sale — no customer selected**
User does not select a customer and completes the sale.
Assert: POST /api/sales is called with `customerId: null`.

### Customer Pages

**Scenario: Customer detail shows all contacts grouped by type**
Mock GET /api/customers/:id to return a customer with one Phone, one Email, and one Address contact.
Assert: all three contacts are displayed.
Assert: each contact's label (e.g., 'Mobile', 'Home') is visible.

**Scenario: Add contact form — required field validation**
User opens the add contact form, selects ContactType = 'Phone', leaves Value blank, and submits.
Assert: POST /api/customers/:id/contacts is not called.
Assert: a validation message is visible on the Value field.

### Void Sale

**Scenario: Void requires confirmation**
User clicks the Void button on an active sale.
Assert: a confirmation dialog or prompt appears before PUT /api/sales/:id/void is called.
User cancels the dialog.
Assert: PUT /api/sales/:id/void is NOT called.

**Scenario: Void success — sale marked as voided**
Mock PUT /api/sales/:id/void to return 200 with `status: 'Voided'`.
User confirms the void.
Assert: the sale status display updates to 'Voided'.
Assert: the Void button is no longer visible or is disabled.

### Reports Screen

**Scenario: Date range required before fetch**
User clicks the Run Report button without selecting a date range.
Assert: GET /api/reports/sales is not called.
Assert: a message prompts the user to select dates.

**Scenario: Summary level report displays totals**
Mock GET /api/reports/sales?detail=summary to return summary fixture.
Assert: sale count, item count, and grand total are all visible on screen.

**Scenario: CSV export triggers file download**
Mock GET /api/reports/sales?format=csv to return CSV content with correct Content-Type.
User clicks the Export CSV button.
Assert: the download is initiated (assert the link or fetch is called with `format=csv`).

### Receipt View

**Scenario: Receipt HTML is displayed in an iframe**
Mock GET /api/sales/:id/receipt to return HTML string.
Assert: an iframe is present with the receipt content loaded.

**Scenario: Print button triggers window.print**
`window.print` must be mocked: `vi.spyOn(window, 'print').mockImplementation(() => {})`.
User clicks the Print button.
Assert: `window.print` was called once.

---

## Output Paths

```
client/src/
├── mocks/
│   ├── fixtures.js            ← shared mock data objects
│   └── handlers.js            ← default MSW handlers (happy path)
├── test-setup.js              ← imports @testing-library/jest-dom
├── pages/
│   ├── Customers/
│   │   ├── CustomerList.test.jsx
│   │   └── CustomerDetail.test.jsx
│   ├── Items/
│   │   ├── ItemList.test.jsx
│   │   └── ItemDetail.test.jsx
│   ├── Inventory/
│   │   └── InventorySearch.test.jsx
│   ├── Sale/
│   │   └── SaleScreen.test.jsx   ← most comprehensive test file
│   ├── Reports/
│   │   └── ReportsScreen.test.jsx
│   └── Receipt/
│       └── ReceiptView.test.jsx
```

---

## Module Scope

Generate tests for modules in this order:

1. `ui-customers` — CustomerList, CustomerDetail, ContactForm
2. `ui-items` — ItemList, ItemDetail
3. `ui-inventory` — InventorySearch
4. `ui-sale-screen` — SaleScreen (most complex — allocate the most test coverage)
5. `ui-reports` — ReportsScreen
6. `ui-receipt` — ReceiptView
