-- =============================================================================
-- NovaPOS  —  Database Schema
-- =============================================================================
-- Creates the NovaPOS database and all tables.
-- Safe to re-run: every object is guarded with IF NOT EXISTS.
--
-- Run with sqlcmd (Windows Integrated Auth / SQL Express):
--   sqlcmd -S "localhost\SQLEXPRESS" -C -E -i sql\01-schema.sql
--
-- After this, run sql\02-seed.sql to populate reference data and sample items.
-- =============================================================================

-- ─── Create database ─────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'NovaPOS')
BEGIN
    CREATE DATABASE [NovaPOS];
    PRINT 'Created database NovaPOS';
END
GO

USE [NovaPOS];
GO

-- ─── Lookup / reference tables (no FK dependencies) ──────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Store')
BEGIN
    CREATE TABLE [Store] (
        [StoreId]      uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [StoreName]    nvarchar(200)    NOT NULL,
        [AddressLine1] nvarchar(255)    NULL,
        [AddressLine2] nvarchar(255)    NULL,
        [City]         nvarchar(100)    NULL,
        [State]        nvarchar(50)     NULL,
        [Postcode]     nvarchar(20)     NULL,
        [Phone]        nvarchar(50)     NULL,
        [Email]        nvarchar(200)    NULL,
        [IsActive]     bit              NOT NULL DEFAULT 1,
        [CreatedAt]    datetime2        NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]    datetime2        NULL,
        CONSTRAINT [PK_Store] PRIMARY KEY ([StoreId])
    );
    PRINT 'Created table Store';
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ItemStatus')
BEGIN
    CREATE TABLE [ItemStatus] (
        [ItemStatusId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [StatusName]   nvarchar(100)    NOT NULL,
        [Description]  nvarchar(500)    NULL,
        [IsActive]     bit              NOT NULL DEFAULT 1,
        [SortOrder]    int              NULL,
        [CreatedAt]    datetime2        NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_ItemStatus] PRIMARY KEY ([ItemStatusId])
    );
    PRINT 'Created table ItemStatus';
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Category')
BEGIN
    CREATE TABLE [Category] (
        [CategoryId]   uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [CategoryName] nvarchar(200)    NOT NULL,
        [Description]  nvarchar(500)    NULL,
        [IsActive]     bit              NOT NULL DEFAULT 1,
        [SortOrder]    int              NULL,
        [CreatedAt]    datetime2        NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_Category] PRIMARY KEY ([CategoryId])
    );
    PRINT 'Created table Category';
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Supplier')
BEGIN
    CREATE TABLE [Supplier] (
        [SupplierId]        uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [SupplierName]      nvarchar(200)    NOT NULL,
        [Email]             nvarchar(200)    NULL,
        [Phone]             nvarchar(50)     NULL,
        [AddressLine1]      nvarchar(255)    NULL,
        [AddressLine2]      nvarchar(255)    NULL,
        [City]              nvarchar(100)    NULL,
        [State]             nvarchar(50)     NULL,
        [Postcode]          nvarchar(20)     NULL,
        [MainContact]       nvarchar(200)    NULL,
        [SecondaryContact]  nvarchar(200)    NULL,
        [LegacyKey]         nvarchar(100)    NULL,
        [IsActive]          bit              NOT NULL DEFAULT 1,
        [CreatedAt]         datetime2        NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]         datetime2        NULL,
        CONSTRAINT [PK_Supplier] PRIMARY KEY ([SupplierId])
    );
    PRINT 'Created table Supplier';
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AttribType')
BEGIN
    CREATE TABLE [AttribType] (
        [AttribTypeId]   uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [AttribTypeName] nvarchar(200)    NOT NULL,
        [Description]    nvarchar(500)    NULL,
        [IsActive]       bit              NOT NULL DEFAULT 1,
        [SortOrder]      int              NULL,
        [CreatedAt]      datetime2        NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_AttribType] PRIMARY KEY ([AttribTypeId])
    );
    PRINT 'Created table AttribType';
END

-- ─── Attribute list values (→ AttribType) ────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AttribTypeList')
BEGIN
    CREATE TABLE [AttribTypeList] (
        [AttribTypeListId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [AttribTypeId]     uniqueidentifier NOT NULL,
        [Value]            nvarchar(255)    NOT NULL,
        [IsActive]         bit              NOT NULL DEFAULT 1,
        [SortOrder]        int              NULL,
        [CreatedAt]        datetime2        NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_AttribTypeList] PRIMARY KEY ([AttribTypeListId])
    );
    CREATE INDEX [IX_AttribTypeList_AttribTypeId] ON [AttribTypeList] ([AttribTypeId]);
    PRINT 'Created table AttribTypeList';
END

-- ─── Customer (→ nothing) ────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Customer')
BEGIN
    CREATE TABLE [Customer] (
        [CustomerId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [FirstName]  nvarchar(100)    NULL,
        [LastName]   nvarchar(100)    NOT NULL,
        [Notes]      nvarchar(max)    NULL,
        [LegacyKey]  nvarchar(100)    NULL,
        [IsDeleted]  bit              NOT NULL DEFAULT 0,
        [CreatedAt]  datetime2        NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]  datetime2        NULL,
        CONSTRAINT [PK_Customer] PRIMARY KEY ([CustomerId])
    );
    PRINT 'Created table Customer';
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CustContact')
BEGIN
    CREATE TABLE [CustContact] (
        [CustContactId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [CustomerId]    uniqueidentifier NOT NULL,
        [ContactType]   nvarchar(20)     NOT NULL,
        [Label]         nvarchar(50)     NULL,
        [Value]         nvarchar(500)    NULL,
        [AddressLine1]  nvarchar(255)    NULL,
        [AddressLine2]  nvarchar(255)    NULL,
        [City]          nvarchar(100)    NULL,
        [State]         nvarchar(100)    NULL,
        [Postcode]      nvarchar(20)     NULL,
        [Country]       nvarchar(100)    NULL,
        [IsPrimary]     bit              NOT NULL DEFAULT 0,
        [IsDeleted]     bit              NOT NULL DEFAULT 0,
        [CreatedAt]     datetime2        NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_CustContact] PRIMARY KEY ([CustContactId]),
        CONSTRAINT [CK_CustContact_ContactType] CHECK ([ContactType] IN ('Phone', 'Email', 'Address'))
    );
    CREATE INDEX [IX_CustContact_CustomerId]          ON [CustContact] ([CustomerId]);
    CREATE INDEX [IX_CustContact_CustomerId_IsPrimary] ON [CustContact] ([CustomerId], [IsPrimary]);
    PRINT 'Created table CustContact';
END

-- ─── Item catalogue (→ Supplier, Category) ───────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Item')
BEGIN
    CREATE TABLE [Item] (
        [ItemId]      uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [SupplierId]  uniqueidentifier NOT NULL,
        [CategoryId]  uniqueidentifier NOT NULL,
        [DesignNo]    nvarchar(100)    NOT NULL,
        [Description] nvarchar(500)    NULL,
        [RetailPrice] money            NULL,
        [Cost]        money            NULL,
        [IsActive]    bit              NOT NULL DEFAULT 1,
        [CreatedAt]   datetime2        NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]   datetime2        NULL,
        CONSTRAINT [PK_Item] PRIMARY KEY ([ItemId])
    );
    CREATE INDEX [IX_Item_SupplierId] ON [Item] ([SupplierId]);
    CREATE INDEX [IX_Item_CategoryId] ON [Item] ([CategoryId]);
    CREATE INDEX [IX_Item_DesignNo]   ON [Item] ([DesignNo]);
    PRINT 'Created table Item';
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ItemAttrib')
BEGIN
    CREATE TABLE [ItemAttrib] (
        [ItemAttribId]     uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [ItemId]           uniqueidentifier NOT NULL,
        [AttribTypeId]     uniqueidentifier NOT NULL,
        [AttribTypeListId] uniqueidentifier NULL,
        [AttribValue]      nvarchar(500)    NOT NULL,
        [CreatedAt]        datetime2        NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]        datetime2        NULL,
        CONSTRAINT [PK_ItemAttrib] PRIMARY KEY ([ItemAttribId])
    );
    CREATE INDEX [IX_ItemAttrib_ItemId] ON [ItemAttrib] ([ItemId]);
    PRINT 'Created table ItemAttrib';
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ItemHistory')
BEGIN
    CREATE TABLE [ItemHistory] (
        [ItemHistoryId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [ItemId]        uniqueidentifier NOT NULL,
        [ColumnName]    nvarchar(100)    NOT NULL,
        [BeforeValue]   nvarchar(max)    NULL,
        [AfterValue]    nvarchar(max)    NULL,
        [ChangedAt]     datetime2        NOT NULL DEFAULT GETUTCDATE(),
        [UserId]        nvarchar(100)    NULL,
        CONSTRAINT [PK_ItemHistory] PRIMARY KEY ([ItemHistoryId])
    );
    CREATE INDEX [IX_ItemHistory_ItemId] ON [ItemHistory] ([ItemId]);
    PRINT 'Created table ItemHistory';
END

-- ─── Inventory (→ Item, Store, ItemStatus) ───────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'InventoryItem')
BEGIN
    CREATE TABLE [InventoryItem] (
        [InventoryItemId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [ItemId]          uniqueidentifier NOT NULL,
        [StoreId]         uniqueidentifier NOT NULL,
        [StatusId]        uniqueidentifier NOT NULL,
        [StatusUpdatedDT] datetime2        NULL,
        [RetailPrice]     money            NULL,
        [Cost]            money            NULL,
        [AcquisitionDate] datetime2        NULL,
        [Notes]           nvarchar(max)    NULL,
        [LegacyKey]       nvarchar(100)    NULL,
        [IsDeleted]       bit              NOT NULL DEFAULT 0,
        [CreatedAt]       datetime2        NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]       datetime2        NULL,
        CONSTRAINT [PK_InventoryItem] PRIMARY KEY ([InventoryItemId])
    );
    CREATE INDEX [IX_InventoryItem_ItemId]   ON [InventoryItem] ([ItemId]);
    CREATE INDEX [IX_InventoryItem_StoreId]  ON [InventoryItem] ([StoreId]);
    CREATE INDEX [IX_InventoryItem_StatusId] ON [InventoryItem] ([StatusId]);
    PRINT 'Created table InventoryItem';
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'InventoryHistory')
BEGIN
    CREATE TABLE [InventoryHistory] (
        [InventoryHistoryId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [InventoryItemId]    uniqueidentifier NOT NULL,
        [ColumnName]         nvarchar(100)    NOT NULL,
        [BeforeValue]        nvarchar(max)    NULL,
        [AfterValue]         nvarchar(max)    NULL,
        [ChangedAt]          datetime2        NOT NULL DEFAULT GETUTCDATE(),
        [UserId]             nvarchar(100)    NULL,
        CONSTRAINT [PK_InventoryHistory] PRIMARY KEY ([InventoryHistoryId])
    );
    CREATE INDEX [IX_InventoryHistory_InventoryItemId] ON [InventoryHistory] ([InventoryItemId]);
    PRINT 'Created table InventoryHistory';
END

-- ─── Sales (→ Store, Customer, InventoryItem) ────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Sale')
BEGIN
    CREATE TABLE [Sale] (
        [SaleId]        uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [StoreId]       uniqueidentifier NOT NULL,
        [CustomerId]    uniqueidentifier NULL,
        [CustomerName]  nvarchar(200)    NULL,
        [SaleNumber]    int              NOT NULL,
        [SaleDate]      datetime2        NOT NULL DEFAULT GETUTCDATE(),
        [SubTotal]      money            NOT NULL,
        [DiscountTotal] money            NOT NULL DEFAULT 0,
        [GrandTotal]    money            NOT NULL,
        [Status]        nvarchar(20)     NOT NULL DEFAULT 'Active',
        [Memo]          nvarchar(max)    NULL,
        [ReceiptContent] nvarchar(max)   NULL,
        [IsDeleted]     bit              NOT NULL DEFAULT 0,
        [CreatedAt]     datetime2        NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]     datetime2        NULL,
        CONSTRAINT [PK_Sale] PRIMARY KEY ([SaleId])
    );
    CREATE INDEX [IX_Sale_StoreId]    ON [Sale] ([StoreId]);
    CREATE INDEX [IX_Sale_CustomerId] ON [Sale] ([CustomerId]);
    CREATE INDEX [IX_Sale_SaleDate]   ON [Sale] ([SaleDate]);
    PRINT 'Created table Sale';
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SaleLine')
BEGIN
    CREATE TABLE [SaleLine] (
        [SaleLineId]      uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [SaleId]          uniqueidentifier NOT NULL,
        [LineNumber]      int              NOT NULL,
        [InventoryItemId] uniqueidentifier NOT NULL,
        [Description]     nvarchar(500)    NULL,
        [UnitPrice]       money            NOT NULL,
        [Discount]        money            NOT NULL DEFAULT 0,
        [LineTotal]       money            NOT NULL,
        [IsDeleted]       bit              NOT NULL DEFAULT 0,
        [Status]          nvarchar(20)     NOT NULL DEFAULT 'Active',
        [CreatedAt]       datetime2        NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_SaleLine] PRIMARY KEY ([SaleLineId])
    );
    CREATE INDEX [IX_SaleLine_SaleId] ON [SaleLine] ([SaleId]);
    PRINT 'Created table SaleLine';
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SaleTender')
BEGIN
    CREATE TABLE [SaleTender] (
        [SaleTenderId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [SaleId]       uniqueidentifier NOT NULL,
        [TenderMethod] nvarchar(50)     NOT NULL,
        [Amount]       money            NOT NULL,
        [Reference]    nvarchar(100)    NULL,
        [Status]       nvarchar(20)     NOT NULL DEFAULT 'Active',
        [CreatedAt]    datetime2        NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_SaleTender] PRIMARY KEY ([SaleTenderId])
    );
    CREATE INDEX [IX_SaleTender_SaleId] ON [SaleTender] ([SaleId]);
    PRINT 'Created table SaleTender';
END

-- ─── Test database ────────────────────────────────────────────────────────────
-- NovaPosTEST mirrors NovaPOS and is used by Jest/Supertest tests.
-- Run this block separately against master if you also need the test DB.
--
-- IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'NovaPosTEST')
-- BEGIN
--     CREATE DATABASE [NovaPosTEST];
-- END
-- Then re-run this script targeting NovaPosTEST:
--   sqlcmd -S "localhost\SQLEXPRESS" -C -E -d NovaPosTEST -i sql\01-schema.sql
-- (Omit the CREATE DATABASE block — just the USE and table DDL.)

PRINT '';
PRINT '01-schema.sql complete.';
PRINT 'Next: run sql\02-seed.sql to load reference data and sample items.';
