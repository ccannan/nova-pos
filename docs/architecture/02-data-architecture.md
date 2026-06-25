# Data Architecture — POS Data Model
*Revised: 2026-06-13 · Supersedes v1 (2026-06-10)*

---

## Design Principles

1. **Own-data-first**: All POS tables live in a dedicated `NovaPOS` database. Legacy `EdgeWalkerHall` is never modified by POS code. A mapping layer (post-MVP) bridges schemas when needed.

2. **Design vs. instance separation**: `Item` is the design template — the canonical record for a Supplier + DesignNo combination. `InventoryItem` is a unique physical instance of that design. Stock count for any design = `COUNT(*)` of `InventoryItem` rows filtered by `StatusId`.

3. **Offline-ready from day one**: Audit fields (`CreatedAt`, `UpdatedAt`, `IsDeleted`) on all transactional tables. Timestamps are UTC (`GETUTCDATE()`).

4. **UUID primary keys**: `uniqueidentifier` with `NEWSEQUENTIALID()` default on all tables. Collision-safe for future multi-store sync.

5. **Store-aware**: `InventoryItem`, `Sale`, and `SaleLine` carry `StoreId`. Lookup tables (Category, AttribType, ItemStatus, etc.) are global across stores.

6. **Soft delete on transactional data**: `IsDeleted` bit on tables where data must be retained for audit. Lookup tables use `IsActive` instead.

7. **Full change history**: `ItemHistory` logs column-level changes to `Item` rows. `InventoryHistory` logs column-level changes to `InventoryItem` rows — including status transitions, price overrides, and store moves. When `Item.RetailPrice` changes, both history tables receive entries (see History Strategy section).

8. **Payment data separation**: `SaleLine` records item transactions only. `SaleTender` records payment. This allows sales reporting without exposing payment details to unauthorised roles.

9. **Legacy key mapping**: Transactional tables carry a nullable `LegacyKey` column for future mapping to the `EdgeWalkerHall` schema.

---

## Entity Relationship Overview

```
[Supplier] ◄──────────────────────── [Item] ──────────────────► [Category]
                                        │
                              [ItemAttrib] ──► [AttribType] ──► [AttribTypeList]
                                        │
                              [ItemHistory]

[Store] ────────────────────► [InventoryItem] ──► [ItemStatus]
                                        │
                               [InventoryHistory]

[Customer] ──► [CustContact]
     │
     ▼
  [Sale] ──────────────► [SaleLine] ──► [InventoryItem]
     └───────────────────► [SaleTender]
```

---

## Table Definitions

### Store

The physical retail location. All inventory and sales are anchored to a store.

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| StoreId | uniqueidentifier | NO | NEWSEQUENTIALID() | PK |
| StoreName | nvarchar(100) | NO | | |
| AddressLine1 | nvarchar(255) | YES | NULL | |
| AddressLine2 | nvarchar(255) | YES | NULL | |
| City | nvarchar(100) | YES | NULL | |
| State | nvarchar(100) | YES | NULL | |
| Postcode | nvarchar(20) | YES | NULL | |
| Phone | nvarchar(50) | YES | NULL | |
| Email | nvarchar(255) | YES | NULL | |
| IsActive | bit | NO | 1 | |
| CreatedAt | datetime2 | NO | GETUTCDATE() | |
| UpdatedAt | datetime2 | YES | NULL | |

**Indexes**: PK `StoreId`

---

### Supplier

One row per supplier. Contact is deliberately simple — a single address/phone/email with main and secondary contact names.

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| SupplierId | uniqueidentifier | NO | NEWSEQUENTIALID() | PK |
| SupplierName | nvarchar(100) | NO | | |
| Email | nvarchar(255) | YES | NULL | |
| Phone | nvarchar(50) | YES | NULL | |
| AddressLine1 | nvarchar(255) | YES | NULL | |
| AddressLine2 | nvarchar(255) | YES | NULL | |
| City | nvarchar(100) | YES | NULL | |
| State | nvarchar(100) | YES | NULL | |
| Postcode | nvarchar(20) | YES | NULL | |
| MainContact | nvarchar(100) | YES | NULL | |
| SecondaryContact | nvarchar(100) | YES | NULL | |
| LegacyKey | nvarchar(50) | YES | NULL | Future mapping layer |
| IsActive | bit | NO | 1 | |
| CreatedAt | datetime2 | NO | GETUTCDATE() | |
| UpdatedAt | datetime2 | YES | NULL | |

**Indexes**: PK `SupplierId`; IX `SupplierName`

---

### Category

Top-level jewellery categories. Drives UI filtering and can scope attribute sets in a future enhancement.

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| CategoryId | uniqueidentifier | NO | NEWSEQUENTIALID() | PK |
| CategoryName | nvarchar(100) | NO | | e.g. Ring, Chain, Watch, Earring, Pendant |
| Description | nvarchar(255) | YES | NULL | |
| IsActive | bit | NO | 1 | |
| SortOrder | int | YES | NULL | |
| CreatedAt | datetime2 | NO | GETUTCDATE() | |

**Indexes**: PK `CategoryId`; IX `CategoryName` (unique)

---

### AttribType

Defines the attribute dimensions an item can have. Examples: `metalType`, `stoneType`, `Length`, `Carat`, `itemStyle`.

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| AttribTypeId | uniqueidentifier | NO | NEWSEQUENTIALID() | PK |
| AttribTypeName | nvarchar(100) | NO | | e.g. "metalType", "Length" |
| Description | nvarchar(255) | YES | NULL | |
| IsActive | bit | NO | 1 | |
| SortOrder | int | YES | NULL | |
| CreatedAt | datetime2 | NO | GETUTCDATE() | |

**Indexes**: PK `AttribTypeId`; IX `AttribTypeName` (unique)

---

### AttribTypeList

Predefined valid values for a given `AttribType`. Used to drive dropdowns. Attribute values may also be free-text — a list entry is not required.

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| AttribTypeListId | uniqueidentifier | NO | NEWSEQUENTIALID() | PK |
| AttribTypeId | uniqueidentifier | NO | | FK → AttribType |
| Value | nvarchar(255) | NO | | e.g. "18ct Yellow Gold", "Sterling Silver" |
| IsActive | bit | NO | 1 | |
| SortOrder | int | YES | NULL | Display order in dropdown |
| CreatedAt | datetime2 | NO | GETUTCDATE() | |

**Indexes**: PK `AttribTypeListId`; IX `AttribTypeId` (for dropdown population)

---

### Customer

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| CustomerId | uniqueidentifier | NO | NEWSEQUENTIALID() | PK |
| FirstName | nvarchar(100) | YES | NULL | |
| LastName | nvarchar(100) | NO | | |
| Notes | nvarchar(max) | YES | NULL | |
| LegacyKey | nvarchar(50) | YES | NULL | Maps to legacy cuKey |
| IsDeleted | bit | NO | 0 | Soft delete |
| CreatedAt | datetime2 | NO | GETUTCDATE() | |
| UpdatedAt | datetime2 | YES | NULL | |

**Indexes**: PK `CustomerId`; IX `LastName, FirstName`; IX `LegacyKey`; IX `IsDeleted` (filtered)

---

### CustContact

Normalised contact table. A customer may have multiple entries of each `ContactType`.

When `ContactType` is `Phone` or `Email`: `Value` is populated; address columns are NULL.  
When `ContactType` is `Address`: address columns are populated; `Value` is NULL.

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| CustContactId | uniqueidentifier | NO | NEWSEQUENTIALID() | PK |
| CustomerId | uniqueidentifier | NO | | FK → Customer |
| ContactType | nvarchar(20) | NO | | 'Phone', 'Email', 'Address' |
| Label | nvarchar(50) | YES | NULL | 'Home', 'Work', 'Mobile', 'Postal', 'Billing' |
| Value | nvarchar(500) | YES | NULL | Phone number or email address |
| AddressLine1 | nvarchar(255) | YES | NULL | Address rows only |
| AddressLine2 | nvarchar(255) | YES | NULL | |
| City | nvarchar(100) | YES | NULL | |
| State | nvarchar(100) | YES | NULL | |
| Postcode | nvarchar(20) | YES | NULL | |
| Country | nvarchar(100) | YES | NULL | |
| IsPrimary | bit | NO | 0 | Primary contact of this type per customer |
| IsDeleted | bit | NO | 0 | |
| CreatedAt | datetime2 | NO | GETUTCDATE() | |

**Indexes**: PK `CustContactId`; IX `CustomerId, ContactType`; IX `CustomerId, IsPrimary`

**Constraint**: `ContactType` IN ('Phone', 'Email', 'Address')

---

### ItemStatus

Lookup table for valid inventory item statuses. Managed via an admin screen (post-MVP). Seed values:

`Active`, `Sold`, `On Hold`, `Layby`, `Consignment`, `Returned`, `Written Off`

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| ItemStatusId | uniqueidentifier | NO | NEWSEQUENTIALID() | PK |
| StatusName | nvarchar(50) | NO | | |
| Description | nvarchar(255) | YES | NULL | |
| IsActive | bit | NO | 1 | |
| SortOrder | int | YES | NULL | |
| CreatedAt | datetime2 | NO | GETUTCDATE() | |

**Indexes**: PK `ItemStatusId`; IX `StatusName` (unique)

---

### Item

The design template. One row per unique Supplier + DesignNo combination. Not a physical object — physical instances live in `InventoryItem`. Changing `RetailPrice` or `Cost` here cascades to all linked `InventoryItem` rows that do not have an instance override.

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| ItemId | uniqueidentifier | NO | NEWSEQUENTIALID() | PK |
| SupplierId | uniqueidentifier | NO | | FK → Supplier |
| CategoryId | uniqueidentifier | NO | | FK → Category |
| DesignNo | nvarchar(100) | NO | | Supplier's design / style number |
| Description | nvarchar(500) | YES | NULL | |
| RetailPrice | money | YES | NULL | Standard retail price for all instances |
| Cost | money | YES | NULL | Standard cost price for all instances |
| LegacyKey | nvarchar(50) | YES | NULL | Maps to legacy itKey |
| IsActive | bit | NO | 1 | False = no new InventoryItems can be created |
| CreatedAt | datetime2 | NO | GETUTCDATE() | |
| UpdatedAt | datetime2 | YES | NULL | |

**Indexes**: PK `ItemId`; UQ `SupplierId, DesignNo`; IX `CategoryId`; IX `LegacyKey`

---

### ItemAttrib

Attribute values for an item. One row per attribute. `AttribTypeListId` is set when the value was selected from a predefined list; `AttribValue` is always populated with the text representation regardless.

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| ItemAttribId | uniqueidentifier | NO | NEWSEQUENTIALID() | PK |
| ItemId | uniqueidentifier | NO | | FK → Item |
| AttribTypeId | uniqueidentifier | NO | | FK → AttribType |
| AttribTypeListId | uniqueidentifier | YES | NULL | FK → AttribTypeList; NULL if free-text entry |
| AttribValue | nvarchar(500) | NO | | Always populated — text from list or free entry |
| CreatedAt | datetime2 | NO | GETUTCDATE() | |
| UpdatedAt | datetime2 | YES | NULL | |

**Indexes**: PK `ItemAttribId`; IX `ItemId, AttribTypeId`

---

### ItemHistory

Logs all column-level changes to `Item` rows. Written by the application layer on every update.

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| ItemHistoryId | uniqueidentifier | NO | NEWSEQUENTIALID() | PK |
| ItemId | uniqueidentifier | NO | | FK → Item |
| ColumnName | nvarchar(100) | NO | | e.g. 'RetailPrice', 'Description', 'CategoryId' |
| BeforeValue | nvarchar(max) | YES | NULL | |
| AfterValue | nvarchar(max) | YES | NULL | |
| ChangedAt | datetime2 | NO | GETUTCDATE() | |
| UserId | nvarchar(100) | YES | NULL | Future: FK → Users |

**Indexes**: PK `ItemHistoryId`; IX `ItemId, ChangedAt`

---

### InventoryItem

A unique physical instance of an `Item` design. Three rings of the same design = three rows here. This is what gets sold — `SaleLine` references `InventoryItemId`, not `ItemId`.

`RetailPrice` and `Cost` are nullable overrides. Effective price = `COALESCE(InventoryItem.RetailPrice, Item.RetailPrice)`.

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| InventoryItemId | uniqueidentifier | NO | NEWSEQUENTIALID() | PK |
| ItemId | uniqueidentifier | NO | | FK → Item |
| StoreId | uniqueidentifier | NO | | FK → Store |
| StatusId | uniqueidentifier | NO | | FK → ItemStatus |
| StatusUpdatedDT | datetime2 | NO | GETUTCDATE() | When status last changed |
| RetailPrice | money | YES | NULL | Instance override; NULL = inherit Item.RetailPrice |
| Cost | money | YES | NULL | Instance override; NULL = inherit Item.Cost |
| AcquisitionDate | datetime2 | YES | NULL | When this instance entered inventory |
| Notes | nvarchar(max) | YES | NULL | |
| LegacyKey | nvarchar(50) | YES | NULL | |
| IsDeleted | bit | NO | 0 | |
| CreatedAt | datetime2 | NO | GETUTCDATE() | |
| UpdatedAt | datetime2 | YES | NULL | |

**Indexes**: PK `InventoryItemId`; IX `ItemId`; IX `StoreId, StatusId`; IX `LegacyKey`; IX `IsDeleted` (filtered)

---

### InventoryHistory

Logs all column-level changes to `InventoryItem` rows — status transitions, price overrides, store moves, etc. Written by the application layer on every update.

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| InventoryHistoryId | uniqueidentifier | NO | NEWSEQUENTIALID() | PK |
| InventoryItemId | uniqueidentifier | NO | | FK → InventoryItem |
| ColumnName | nvarchar(100) | NO | | e.g. 'StatusId', 'StoreId', 'RetailPrice' |
| BeforeValue | nvarchar(max) | YES | NULL | |
| AfterValue | nvarchar(max) | YES | NULL | |
| ChangedAt | datetime2 | NO | GETUTCDATE() | |
| UserId | nvarchar(100) | YES | NULL | Future: FK → Users |

**Indexes**: PK `InventoryHistoryId`; IX `InventoryItemId, ChangedAt`; IX `ColumnName` (for status-specific queries)

---

### Sale

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| SaleId | uniqueidentifier | NO | NEWSEQUENTIALID() | PK |
| StoreId | uniqueidentifier | NO | | FK → Store |
| CustomerId | uniqueidentifier | YES | NULL | FK → Customer; NULL = walk-in |
| CustomerName | nvarchar(200) | YES | NULL | Snapshot at time of sale |
| SaleNumber | int | NO | | Sequential per store (human-readable) |
| SaleDate | datetime2 | NO | GETUTCDATE() | |
| SubTotal | money | NO | 0 | Sum of SaleLine.LineTotals |
| DiscountTotal | money | NO | 0 | |
| GrandTotal | money | NO | 0 | SubTotal - DiscountTotal |
| Status | nvarchar(20) | NO | 'Active' | 'Active', 'Voided' |
| Memo | nvarchar(max) | YES | NULL | |
| LegacyKey | nvarchar(50) | YES | NULL | Maps to legacy saKey |
| IsDeleted | bit | NO | 0 | |
| CreatedAt | datetime2 | NO | GETUTCDATE() | |
| UpdatedAt | datetime2 | YES | NULL | |

**Indexes**: PK `SaleId`; UQ `StoreId, SaleNumber`; IX `SaleDate`; IX `CustomerId`; IX `LegacyKey`; IX `IsDeleted, Status` (filtered)

---

### SaleLine

One row per `InventoryItem` sold. Each line references exactly one physical instance. Quantity is always 1 for MVP — included as a column for future flexibility (e.g., non-stock lines such as labour or repairs).

Prices are snapshotted at the time of sale — subsequent changes to `Item.RetailPrice` do not retroactively alter historical `SaleLine` records.

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| SaleLineId | uniqueidentifier | NO | NEWSEQUENTIALID() | PK |
| SaleId | uniqueidentifier | NO | | FK → Sale |
| LineNumber | int | NO | | Display order within sale |
| InventoryItemId | uniqueidentifier | NO | | FK → InventoryItem |
| Description | nvarchar(500) | YES | NULL | Snapshot of Item.Description at sale time |
| UnitPrice | money | NO | | Effective price at time of sale |
| Discount | money | NO | 0 | Line-level discount |
| LineTotal | money | NO | | UnitPrice - Discount |
| LegacyKey | nvarchar(50) | YES | NULL | Maps to legacy slKey |
| IsDeleted | bit | NO | 0 | |
| CreatedAt | datetime2 | NO | GETUTCDATE() | |

**Indexes**: PK `SaleLineId`; UQ `SaleId, LineNumber`; IX `InventoryItemId`

---

### SaleTender

Records payment entries for a sale. Separated from `SaleLine` so payment data can be access-controlled independently of item sales data.

One sale may have multiple tender rows (e.g., split payment across methods in future).

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| SaleTenderId | uniqueidentifier | NO | NEWSEQUENTIALID() | PK |
| SaleId | uniqueidentifier | NO | | FK → Sale |
| TenderMethod | nvarchar(50) | NO | | 'Cash' (MVP). Future: 'Card', 'Voucher', 'Layby' |
| Amount | money | NO | | |
| Reference | nvarchar(100) | YES | NULL | Card auth code, voucher number, etc. |
| CreatedAt | datetime2 | NO | GETUTCDATE() | |

**Indexes**: PK `SaleTenderId`; IX `SaleId`

---

## Foreign Key Relationships & Cascade Behaviour

| Relationship | On Delete |
|---|---|
| CustContact.CustomerId → Customer.CustomerId | CASCADE |
| Item.SupplierId → Supplier.SupplierId | RESTRICT |
| Item.CategoryId → Category.CategoryId | RESTRICT |
| ItemAttrib.ItemId → Item.ItemId | CASCADE |
| ItemAttrib.AttribTypeId → AttribType.AttribTypeId | RESTRICT |
| ItemAttrib.AttribTypeListId → AttribTypeList.AttribTypeListId | SET NULL |
| AttribTypeList.AttribTypeId → AttribType.AttribTypeId | RESTRICT |
| ItemHistory.ItemId → Item.ItemId | CASCADE |
| InventoryItem.ItemId → Item.ItemId | RESTRICT |
| InventoryItem.StoreId → Store.StoreId | RESTRICT |
| InventoryItem.StatusId → ItemStatus.ItemStatusId | RESTRICT |
| InventoryHistory.InventoryItemId → InventoryItem.InventoryItemId | CASCADE |
| Sale.StoreId → Store.StoreId | RESTRICT |
| Sale.CustomerId → Customer.CustomerId | SET NULL |
| SaleLine.SaleId → Sale.SaleId | CASCADE |
| SaleLine.InventoryItemId → InventoryItem.InventoryItemId | RESTRICT |
| SaleTender.SaleId → Sale.SaleId | CASCADE |

**RESTRICT** = block the delete if child rows exist. Protects Supplier, Item, Store, and ItemStatus records that have history or live inventory.

---

## History Table Strategy

History is written by the **application layer** (Express controllers), not database triggers. The pattern on every update:

1. Read the current row before applying changes
2. For each column that changed, insert one row into `ItemHistory` or `InventoryHistory` with `BeforeValue` / `AfterValue` as nvarchar representations
3. Apply the update to the main table

**Price cascade when `Item.RetailPrice` changes:**

1. Write one `ItemHistory` row on `Item` (ColumnName = 'RetailPrice')
2. For every linked `InventoryItem` where `RetailPrice IS NULL` (inheriting from template):
   - No write to `InventoryItem` — effective price is computed via `COALESCE` at query time
   - Write one `InventoryHistory` row: ColumnName = 'EffectiveRetailPrice', BeforeValue = old, AfterValue = new
3. `InventoryItem` rows with a price override are unaffected — their override still applies

This keeps the cascade lightweight while maintaining a complete audit trail.

---

## Stock Count Query

```sql
SELECT
    sup.SupplierName,
    i.DesignNo,
    i.Description,
    ist.StatusName,
    COUNT(*) AS Quantity
FROM InventoryItem ii
JOIN Item i       ON ii.ItemId   = i.ItemId
JOIN Supplier sup ON i.SupplierId = sup.SupplierId
JOIN ItemStatus ist ON ii.StatusId = ist.ItemStatusId
WHERE ii.IsDeleted = 0
GROUP BY sup.SupplierName, i.DesignNo, i.Description, ist.StatusName
ORDER BY sup.SupplierName, i.DesignNo, ist.StatusName
```

---

## Schema Deployment

Tables are created in a new `NovaPOS` database on the existing SQL Server instance:

```
Server=localhost\SQLEXPRESS;Database=NovaPOS;Trusted_Connection=True;
```

This keeps POS data completely separate from `EdgeWalkerHall`. Both databases coexist on the same instance.

---

## Legacy Schema Mapping (Post-MVP)

| New Table | Legacy Table | Key |
|-----------|-------------|-----|
| Customer | customers | LegacyKey → cuKey |
| Item | items | LegacyKey → itKey |
| InventoryItem | items (instances) | LegacyKey → itKey |
| Sale | sale | LegacyKey → saKey |
| SaleLine | saleline | LegacyKey → slKey |

---

## Extension Points (Post-MVP)

| Feature | Schema Change |
|---------|--------------|
| User auth | New `Users` table; `UserId` on history tables becomes a FK |
| EFTPOS / card | `SaleTender.TenderMethod` already supports 'Card'; `Reference` column holds auth code |
| Layby / deposits | New `Layby` table; `SaleTender.TenderMethod` = 'Layby'; `ItemStatus` row = 'Layby' |
| Multi-store sync | Add `SyncVersion` (rowversion) + `LastSyncedAt` to transactional tables |
| Offline resilience | Local SQLite mirror; sync engine uses `UpdatedAt` for change detection |
| Tax / GST | New `TaxCode` table; add `TaxCodeId`, `TaxAmount` to `SaleLine` |
| Category-scoped attributes | Add optional `CategoryId` FK to `AttribType` |
| Repair jobs | New `RepairJob` table; `InventoryItem.StatusId` = 'In Repair' |
| Non-stock sale lines | Add `LineType` ('Item'/'Service') to `SaleLine`; nullable `InventoryItemId` |
