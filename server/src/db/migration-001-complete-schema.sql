-- =====================================================
-- Migration 001: Complete NovaPOS Schema & Fix Seeds
-- =====================================================

-- 1. Add Status column to SaleLine (for void sale flow)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('SaleLine') AND name = 'Status')
BEGIN
    ALTER TABLE [SaleLine] ADD [Status] nvarchar(20) NOT NULL DEFAULT 'Active';
END

-- 2. Create AttribTypeList
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AttribTypeList')
BEGIN
    CREATE TABLE [AttribTypeList] (
        [AttribTypeListId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [AttribTypeId] uniqueidentifier NOT NULL,
        [Value] nvarchar(255) NOT NULL,
        [IsActive] bit NOT NULL DEFAULT 1,
        [SortOrder] int NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_AttribTypeList] PRIMARY KEY ([AttribTypeListId])
    );
    CREATE INDEX [IX_AttribTypeList_AttribTypeId] ON [AttribTypeList] ([AttribTypeId]);
END

-- 3. Create CustContact
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CustContact')
BEGIN
    CREATE TABLE [CustContact] (
        [CustContactId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [CustomerId] uniqueidentifier NOT NULL,
        [ContactType] nvarchar(20) NOT NULL,
        [Label] nvarchar(50) NULL,
        [Value] nvarchar(500) NULL,
        [AddressLine1] nvarchar(255) NULL,
        [AddressLine2] nvarchar(255) NULL,
        [City] nvarchar(100) NULL,
        [State] nvarchar(100) NULL,
        [Postcode] nvarchar(20) NULL,
        [Country] nvarchar(100) NULL,
        [IsPrimary] bit NOT NULL DEFAULT 0,
        [IsDeleted] bit NOT NULL DEFAULT 0,
        [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_CustContact] PRIMARY KEY ([CustContactId]),
        CONSTRAINT [CK_CustContact_ContactType] CHECK ([ContactType] IN ('Phone', 'Email', 'Address'))
    );
    CREATE INDEX [IX_CustContact_CustomerId] ON [CustContact] ([CustomerId]);
    CREATE INDEX [IX_CustContact_CustomerId_IsPrimary] ON [CustContact] ([CustomerId], [IsPrimary]);
END

-- 4. Create ItemAttrib
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ItemAttrib')
BEGIN
    CREATE TABLE [ItemAttrib] (
        [ItemAttribId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [ItemId] uniqueidentifier NOT NULL,
        [AttribTypeId] uniqueidentifier NOT NULL,
        [AttribTypeListId] uniqueidentifier NULL,
        [AttribValue] nvarchar(500) NOT NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_ItemAttrib] PRIMARY KEY ([ItemAttribId])
    );
    CREATE INDEX [IX_ItemAttrib_ItemId] ON [ItemAttrib] ([ItemId]);
END

-- 5. Create ItemHistory
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ItemHistory')
BEGIN
    CREATE TABLE [ItemHistory] (
        [ItemHistoryId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [ItemId] uniqueidentifier NOT NULL,
        [ColumnName] nvarchar(100) NOT NULL,
        [BeforeValue] nvarchar(max) NULL,
        [AfterValue] nvarchar(max) NULL,
        [ChangedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
        [UserId] nvarchar(100) NULL,
        CONSTRAINT [PK_ItemHistory] PRIMARY KEY ([ItemHistoryId])
    );
    CREATE INDEX [IX_ItemHistory_ItemId] ON [ItemHistory] ([ItemId]);
END

-- 6. Create InventoryHistory
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'InventoryHistory')
BEGIN
    CREATE TABLE [InventoryHistory] (
        [InventoryHistoryId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [InventoryItemId] uniqueidentifier NOT NULL,
        [ColumnName] nvarchar(100) NOT NULL,
        [BeforeValue] nvarchar(max) NULL,
        [AfterValue] nvarchar(max) NULL,
        [ChangedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
        [UserId] nvarchar(100) NULL,
        CONSTRAINT [PK_InventoryHistory] PRIMARY KEY ([InventoryHistoryId])
    );
    CREATE INDEX [IX_InventoryHistory_InventoryItemId] ON [InventoryHistory] ([InventoryItemId]);
END

-- 7. Create SaleTender
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SaleTender')
BEGIN
    CREATE TABLE [SaleTender] (
        [SaleTenderId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [SaleId] uniqueidentifier NOT NULL,
        [TenderMethod] nvarchar(50) NOT NULL,
        [Amount] money NOT NULL,
        [Reference] nvarchar(100) NULL,
        [Status] nvarchar(20) NOT NULL DEFAULT 'Active',
        [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_SaleTender] PRIMARY KEY ([SaleTenderId])
    );
    CREATE INDEX [IX_SaleTender_SaleId] ON [SaleTender] ([SaleId]);
END

-- 8. Fix ItemStatus seed data with known GUIDs (matching test constants)
DELETE FROM ItemStatus;
INSERT INTO ItemStatus (ItemStatusId, StatusName, Description, SortOrder) VALUES
('10000001-0000-0000-0000-000000000001', 'Active', 'Available for sale', 1),
('10000001-0000-0000-0000-000000000002', 'Sold', 'Sold to customer', 2),
('10000001-0000-0000-0000-000000000003', 'On Hold', 'Reserved for customer', 3),
('10000001-0000-0000-0000-000000000004', 'Layby', 'On layaway', 4),
('10000001-0000-0000-0000-000000000005', 'Consignment', 'Consignment item', 5),
('10000001-0000-0000-0000-000000000006', 'Returned', 'Returned from customer', 6),
('10000001-0000-0000-0000-000000000007', 'Written Off', 'Written off inventory', 7);

-- 9. Fix Store seed data with known GUID (matching test constants)
DELETE FROM Store WHERE StoreId NOT IN ('20000001-0000-0000-0000-000000000001');
UPDATE Store SET StoreId = '20000001-0000-0000-0000-000000000001' WHERE StoreName = 'Main Store';
IF NOT EXISTS (SELECT * FROM Store WHERE StoreId = '20000001-0000-0000-0000-000000000001')
BEGIN
    INSERT INTO Store (StoreId, StoreName, AddressLine1, City, State, Phone, Email) VALUES
    ('20000001-0000-0000-0000-000000000001', 'Main Store', '123 Main Street', 'Brisbane', 'QLD', '(07) 1234 5678', 'orders@novapos.local');
END

-- 10. Seed remaining lookup data (only if not exists)
IF NOT EXISTS (SELECT * FROM Category WHERE CategoryName = 'Rings')
BEGIN
    INSERT INTO Category (CategoryName, Description, SortOrder) VALUES
    ('Rings', 'Wedding rings, engagement rings, dress rings', 1),
    ('Chains', 'Necklaces and chains', 2),
    ('Earrings', 'Stud earrings, drop earrings, hoops', 3),
    ('Pendants', 'Pendant necklaces', 4),
    ('Watches', 'Wrist watches', 5),
    ('Brooches', 'Pins and brooches', 6);
END

IF NOT EXISTS (SELECT * FROM Supplier WHERE SupplierName = 'Australian Jewellers Supply')
BEGIN
    INSERT INTO Supplier (SupplierName, Email, Phone, AddressLine1, City, State, MainContact) VALUES
    ('Australian Jewellers Supply', 'orders@ajsupply.com.au', '(02) 9876 5432', '45 George Street', 'Sydney', 'NSW', 'John Williams'),
    ('Golden Gate Imports', 'sales@goldengate.com.au', '(03) 8765 4321', '78 Collins Street', 'Melbourne', 'VIC', 'Sarah Chen');
END

IF NOT EXISTS (SELECT * FROM AttribType WHERE AttribTypeName = 'Metal Type')
BEGIN
    INSERT INTO AttribType (AttribTypeName, Description, SortOrder) VALUES
    ('Metal Type', 'Type of metal used', 1),
    ('Stone Type', 'Primary stone or gem', 2),
    ('Carat Weight', 'Weight in carats', 3),
    ('Ring Size', 'Ring size', 4),
    ('Length', 'Chain or bracelet length', 5),
    ('Style', 'Design style', 6),
    ('Brand', 'Manufacturer or brand', 7);
END

PRINT 'Migration 001 complete';