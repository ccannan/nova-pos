const sql = require('mssql');

const config = {
    server: 'localhost',
    port: 1433,
    database: 'NovaPOS',
    options: {
        trustedConnection: true,
        trustServerCertificate: true
    }
};

async function createTables() {
    try {
        console.log('Connecting to NovaPOS database...');
        const pool = await sql.connect(config);
        
        const tables = [
            // Category table
            {
                name: 'Category',
                sql: `
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Category')
BEGIN
    CREATE TABLE [Category] (
        [CategoryId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [CategoryName] nvarchar(100) NOT NULL,
        [Description] nvarchar(255) NULL,
        [IsActive] bit NOT NULL DEFAULT 1,
        [SortOrder] int NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_Category] PRIMARY KEY ([CategoryId])
    )
    CREATE UNIQUE INDEX [IX_Category_CategoryName] ON [Category] ([CategoryName])
    PRINT 'Category table created'
END`
            },
            // AttribType table
            {
                name: 'AttribType',
                sql: `
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AttribType')
BEGIN
    CREATE TABLE [AttribType] (
        [AttribTypeId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [AttribTypeName] nvarchar(100) NOT NULL,
        [Description] nvarchar(255) NULL,
        [IsActive] bit NOT NULL DEFAULT 1,
        [SortOrder] int NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_AttribType] PRIMARY KEY ([AttribTypeId])
    )
    CREATE UNIQUE INDEX [IX_AttribType_AttribTypeName] ON [AttribType] ([AttribTypeName])
    PRINT 'AttribType table created'
END`
            },
            // AttribTypeList table
            {
                name: 'AttribTypeList',
                sql: `
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
    )
    CREATE INDEX [IX_AttribTypeList_AttribTypeId] ON [AttribTypeList] ([AttribTypeId])
    PRINT 'AttribTypeList table created'
END`
            },
            // Customer table
            {
                name: 'Customer',
                sql: `
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Customer')
BEGIN
    CREATE TABLE [Customer] (
        [CustomerId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [FirstName] nvarchar(100) NULL,
        [LastName] nvarchar(100) NOT NULL,
        [Notes] nvarchar(max) NULL,
        [LegacyKey] nvarchar(50) NULL,
        [IsDeleted] bit NOT NULL DEFAULT 0,
        [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_Customer] PRIMARY KEY ([CustomerId])
    )
    CREATE INDEX [IX_Customer_LastName_FirstName] ON [Customer] ([LastName], [FirstName])
    CREATE INDEX [IX_Customer_LegacyKey] ON [Customer] ([LegacyKey])
    CREATE INDEX [IX_Customer_IsDeleted] ON [Customer] ([IsDeleted]) WHERE [IsDeleted] = 0
    PRINT 'Customer table created'
END`
            },
            // CustContact table
            {
                name: 'CustContact',
                sql: `
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
    )
    CREATE INDEX [IX_CustContact_CustomerId_ContactType] ON [CustContact] ([CustomerId], [ContactType])
    CREATE INDEX [IX_CustContact_CustomerId_IsPrimary] ON [CustContact] ([CustomerId], [IsPrimary])
    PRINT 'CustContact table created'
END`
            },
            // ItemStatus table
            {
                name: 'ItemStatus',
                sql: `
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ItemStatus')
BEGIN
    CREATE TABLE [ItemStatus] (
        [ItemStatusId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [StatusName] nvarchar(50) NOT NULL,
        [Description] nvarchar(255) NULL,
        [IsActive] bit NOT NULL DEFAULT 1,
        [SortOrder] int NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_ItemStatus] PRIMARY KEY ([ItemStatusId])
    )
    CREATE UNIQUE INDEX [IX_ItemStatus_StatusName] ON [ItemStatus] ([StatusName])
    PRINT 'ItemStatus table created'
END`
            },
            // Item table
            {
                name: 'Item',
                sql: `
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Item')
BEGIN
    CREATE TABLE [Item] (
        [ItemId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [SupplierId] uniqueidentifier NOT NULL,
        [CategoryId] uniqueidentifier NOT NULL,
        [DesignNo] nvarchar(100) NOT NULL,
        [Description] nvarchar(500) NULL,
        [RetailPrice] money NULL,
        [Cost] money NULL,
        [LegacyKey] nvarchar(50) NULL,
        [IsActive] bit NOT NULL DEFAULT 1,
        [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_Item] PRIMARY KEY ([ItemId])
    )
    CREATE UNIQUE INDEX [IX_Item_SupplierId_DesignNo] ON [Item] ([SupplierId], [DesignNo])
    CREATE INDEX [IX_Item_CategoryId] ON [Item] ([CategoryId])
    CREATE INDEX [IX_Item_LegacyKey] ON [Item] ([LegacyKey])
    PRINT 'Item table created'
END`
            },
            // ItemAttrib table
            {
                name: 'ItemAttrib',
                sql: `
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
    )
    CREATE INDEX [IX_ItemAttrib_ItemId_AttribTypeId] ON [ItemAttrib] ([ItemId], [AttribTypeId])
    PRINT 'ItemAttrib table created'
END`
            },
            // ItemHistory table
            {
                name: 'ItemHistory',
                sql: `
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
    )
    CREATE INDEX [IX_ItemHistory_ItemId_ChangedAt] ON [ItemHistory] ([ItemId], [ChangedAt])
    PRINT 'ItemHistory table created'
END`
            },
            // InventoryItem table
            {
                name: 'InventoryItem',
                sql: `
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'InventoryItem')
BEGIN
    CREATE TABLE [InventoryItem] (
        [InventoryItemId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [ItemId] uniqueidentifier NOT NULL,
        [StoreId] uniqueidentifier NOT NULL,
        [StatusId] uniqueidentifier NOT NULL,
        [StatusUpdatedDT] datetime2 NOT NULL DEFAULT GETUTCDATE(),
        [RetailPrice] money NULL,
        [Cost] money NULL,
        [AcquisitionDate] datetime2 NULL,
        [Notes] nvarchar(max) NULL,
        [LegacyKey] nvarchar(50) NULL,
        [IsDeleted] bit NOT NULL DEFAULT 0,
        [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_InventoryItem] PRIMARY KEY ([InventoryItemId])
    )
    CREATE INDEX [IX_InventoryItem_ItemId] ON [InventoryItem] ([ItemId])
    CREATE INDEX [IX_InventoryItem_StoreId_StatusId] ON [InventoryItem] ([StoreId], [StatusId])
    CREATE INDEX [IX_InventoryItem_LegacyKey] ON [InventoryItem] ([LegacyKey])
    CREATE INDEX [IX_InventoryItem_IsDeleted] ON [InventoryItem] ([IsDeleted]) WHERE [IsDeleted] = 0
    PRINT 'InventoryItem table created'
END`
            },
            // InventoryHistory table
            {
                name: 'InventoryHistory',
                sql: `
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
    )
    CREATE INDEX [IX_InventoryHistory_InventoryItemId_ChangedAt] ON [InventoryHistory] ([InventoryItemId], [ChangedAt])
    CREATE INDEX [IX_InventoryHistory_ColumnName] ON [InventoryHistory] ([ColumnName])
    PRINT 'InventoryHistory table created'
END`
            },
            // Sale table
            {
                name: 'Sale',
                sql: `
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Sale')
BEGIN
    CREATE TABLE [Sale] (
        [SaleId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [StoreId] uniqueidentifier NOT NULL,
        [CustomerId] uniqueidentifier NULL,
        [CustomerName] nvarchar(200) NULL,
        [SaleNumber] int NOT NULL,
        [SaleDate] datetime2 NOT NULL DEFAULT GETUTCDATE(),
        [SubTotal] money NOT NULL DEFAULT 0,
        [DiscountTotal] money NOT NULL DEFAULT 0,
        [GrandTotal] money NOT NULL DEFAULT 0,
        [Status] nvarchar(20) NOT NULL DEFAULT 'Active',
        [Memo] nvarchar(max) NULL,
        [LegacyKey] nvarchar(50) NULL,
        [IsDeleted] bit NOT NULL DEFAULT 0,
        [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_Sale] PRIMARY KEY ([SaleId])
    )
    CREATE UNIQUE INDEX [IX_Sale_StoreId_SaleNumber] ON [Sale] ([StoreId], [SaleNumber])
    CREATE INDEX [IX_Sale_SaleDate] ON [Sale] ([SaleDate])
    CREATE INDEX [IX_Sale_CustomerId] ON [Sale] ([CustomerId])
    CREATE INDEX [IX_Sale_LegacyKey] ON [Sale] ([LegacyKey])
    CREATE INDEX [IX_Sale_IsDeleted_Status] ON [Sale] ([IsDeleted], [Status]) WHERE [IsDeleted] = 0
    PRINT 'Sale table created'
END`
            },
            // SaleLine table
            {
                name: 'SaleLine',
                sql: `
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SaleLine')
BEGIN
    CREATE TABLE [SaleLine] (
        [SaleLineId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [SaleId] uniqueidentifier NOT NULL,
        [LineNumber] int NOT NULL,
        [InventoryItemId] uniqueidentifier NOT NULL,
        [Description] nvarchar(500) NULL,
        [UnitPrice] money NOT NULL,
        [Discount] money NOT NULL DEFAULT 0,
        [LineTotal] money NOT NULL,
        [LegacyKey] nvarchar(50) NULL,
        [IsDeleted] bit NOT NULL DEFAULT 0,
        [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_SaleLine] PRIMARY KEY ([SaleLineId])
    )
    CREATE UNIQUE INDEX [IX_SaleLine_SaleId_LineNumber] ON [SaleLine] ([SaleId], [LineNumber])
    CREATE INDEX [IX_SaleLine_InventoryItemId] ON [SaleLine] ([InventoryItemId])
    PRINT 'SaleLine table created'
END`
            },
            // SaleTender table
            {
                name: 'SaleTender',
                sql: `
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SaleTender')
BEGIN
    CREATE TABLE [SaleTender] (
        [SaleTenderId] uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
        [SaleId] uniqueidentifier NOT NULL,
        [TenderMethod] nvarchar(50) NOT NULL,
        [Amount] money NOT NULL,
        [Reference] nvarchar(100) NULL,
        [CreatedAt] datetime2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_SaleTender] PRIMARY KEY ([SaleTenderId])
    )
    CREATE INDEX [IX_SaleTender_SaleId] ON [SaleTender] ([SaleId])
    PRINT 'SaleTender table created'
END`
            }
        ];

        // Create all tables
        for (const table of tables) {
            console.log(`Creating ${table.name} table...`);
            await pool.request().query(table.sql);
        }

        // Create foreign key constraints
        console.log('Creating foreign key constraints...');
        const constraints = [
            "IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_CustContact_Customer') ALTER TABLE [CustContact] ADD CONSTRAINT [FK_CustContact_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [Customer]([CustomerId]) ON DELETE CASCADE",
            "IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Item_Supplier') ALTER TABLE [Item] ADD CONSTRAINT [FK_Item_Supplier] FOREIGN KEY ([SupplierId]) REFERENCES [Supplier]([SupplierId])",
            "IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Item_Category') ALTER TABLE [Item] ADD CONSTRAINT [FK_Item_Category] FOREIGN KEY ([CategoryId]) REFERENCES [Category]([CategoryId])",
            "IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ItemAttrib_Item') ALTER TABLE [ItemAttrib] ADD CONSTRAINT [FK_ItemAttrib_Item] FOREIGN KEY ([ItemId]) REFERENCES [Item]([ItemId]) ON DELETE CASCADE",
            "IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ItemAttrib_AttribType') ALTER TABLE [ItemAttrib] ADD CONSTRAINT [FK_ItemAttrib_AttribType] FOREIGN KEY ([AttribTypeId]) REFERENCES [AttribType]([AttribTypeId])",
            "IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ItemAttrib_AttribTypeList') ALTER TABLE [ItemAttrib] ADD CONSTRAINT [FK_ItemAttrib_AttribTypeList] FOREIGN KEY ([AttribTypeListId]) REFERENCES [AttribTypeList]([AttribTypeListId]) ON DELETE SET NULL",
            "IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_AttribTypeList_AttribType') ALTER TABLE [AttribTypeList] ADD CONSTRAINT [FK_AttribTypeList_AttribType] FOREIGN KEY ([AttribTypeId]) REFERENCES [AttribType]([AttribTypeId])",
            "IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ItemHistory_Item') ALTER TABLE [ItemHistory] ADD CONSTRAINT [FK_ItemHistory_Item] FOREIGN KEY ([ItemId]) REFERENCES [Item]([ItemId]) ON DELETE CASCADE",
            "IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_InventoryItem_Item') ALTER TABLE [InventoryItem] ADD CONSTRAINT [FK_InventoryItem_Item] FOREIGN KEY ([ItemId]) REFERENCES [Item]([ItemId])",
            "IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_InventoryItem_Store') ALTER TABLE [InventoryItem] ADD CONSTRAINT [FK_InventoryItem_Store] FOREIGN KEY ([StoreId]) REFERENCES [Store]([StoreId])",
            "IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_InventoryItem_ItemStatus') ALTER TABLE [InventoryItem] ADD CONSTRAINT [FK_InventoryItem_ItemStatus] FOREIGN KEY ([StatusId]) REFERENCES [ItemStatus]([ItemStatusId])",
            "IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_InventoryHistory_InventoryItem') ALTER TABLE [InventoryHistory] ADD CONSTRAINT [FK_InventoryHistory_InventoryItem] FOREIGN KEY ([InventoryItemId]) REFERENCES [InventoryItem]([InventoryItemId]) ON DELETE CASCADE",
            "IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Sale_Store') ALTER TABLE [Sale] ADD CONSTRAINT [FK_Sale_Store] FOREIGN KEY ([StoreId]) REFERENCES [Store]([StoreId])",
            "IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Sale_Customer') ALTER TABLE [Sale] ADD CONSTRAINT [FK_Sale_Customer] FOREIGN KEY ([CustomerId]) REFERENCES [Customer]([CustomerId]) ON DELETE SET NULL",
            "IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_SaleLine_Sale') ALTER TABLE [SaleLine] ADD CONSTRAINT [FK_SaleLine_Sale] FOREIGN KEY ([SaleId]) REFERENCES [Sale]([SaleId]) ON DELETE CASCADE",
            "IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_SaleLine_InventoryItem') ALTER TABLE [SaleLine] ADD CONSTRAINT [FK_SaleLine_InventoryItem] FOREIGN KEY ([InventoryItemId]) REFERENCES [InventoryItem]([InventoryItemId])",
            "IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_SaleTender_Sale') ALTER TABLE [SaleTender] ADD CONSTRAINT [FK_SaleTender_Sale] FOREIGN KEY ([SaleId]) REFERENCES [Sale]([SaleId]) ON DELETE CASCADE"
        ];

        for (const constraint of constraints) {
            try {
                await pool.request().query(constraint);
                console.log('✓ Added constraint');
            } catch (err) {
                console.log(`⚠ Constraint issue (likely already exists): ${err.message}`);
            }
        }

        console.log('\nDatabase schema creation completed successfully!');
        
        await pool.close();
    } catch (err) {
        console.error('Error creating schema:', err);
        process.exit(1);
    }
}

createTables();