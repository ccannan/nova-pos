# Complete NovaPOS Schema Creation
param(
    [string]$server = "localhost\SQLEXPRESS",
    [string]$database = "NovaPOS"
)

Add-Type -AssemblyName System.Data

try {
    Write-Host "Connecting to $database on $server..."
    
    $connStr = "Server=$server;Database=$database;Trusted_Connection=True;TrustServerCertificate=True;"
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    Write-Host "Connected successfully"
    
    $cmd = $conn.CreateCommand()
    $cmd.CommandTimeout = 120
    
    # Create all tables in dependency order
    Write-Host "Creating tables in dependency order..."
    
    # Category table first
    Write-Host "Creating Category table..."
    $cmd.CommandText = @'
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
END
'@
    $cmd.ExecuteNonQuery() | Out-Null
    
    # AttribType table
    Write-Host "Creating AttribType table..."
    $cmd.CommandText = @'
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
END
'@
    $cmd.ExecuteNonQuery() | Out-Null
    
    # ItemStatus table
    Write-Host "Creating ItemStatus table..."
    $cmd.CommandText = @'
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
END
'@
    $cmd.ExecuteNonQuery() | Out-Null
    
    # Customer table
    Write-Host "Creating Customer table..."
    $cmd.CommandText = @'
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
END
'@
    $cmd.ExecuteNonQuery() | Out-Null
    
    # Complete remaining tables... 
    Write-Host "Creating remaining tables..."
    $cmd.CommandText = @'
-- Item table (depends on Supplier, Category)
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
END

-- InventoryItem table (depends on Item, Store, ItemStatus)
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
END

-- Sale table (depends on Store, Customer)
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
END

-- SaleLine table (depends on Sale, InventoryItem)
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
END
'@
    $cmd.ExecuteNonQuery() | Out-Null
    
    # Insert seed data
    Write-Host "Inserting seed data..."
    $cmd.CommandText = @'
-- ItemStatus seed data
IF NOT EXISTS (SELECT * FROM ItemStatus WHERE StatusName = 'Active')
BEGIN
    INSERT INTO ItemStatus (StatusName, Description, SortOrder) VALUES 
    ('Active', 'Available for sale', 1),
    ('Sold', 'Sold to customer', 2),
    ('On Hold', 'Reserved for customer', 3),
    ('Layby', 'On layaway', 4),
    ('Consignment', 'Consignment item', 5)
END

-- Default store (if not exists)
IF NOT EXISTS (SELECT * FROM Store WHERE StoreName = 'Main Store')
BEGIN
    INSERT INTO Store (StoreName, AddressLine1, City, State, Phone, Email) VALUES 
    ('Main Store', '123 Main Street', 'Brisbane', 'QLD', '(07) 1234 5678', 'orders@novapos.local')
END

-- Sample categories
IF NOT EXISTS (SELECT * FROM Category WHERE CategoryName = 'Rings')
BEGIN
    INSERT INTO Category (CategoryName, Description, SortOrder) VALUES 
    ('Rings', 'Wedding rings, engagement rings, dress rings', 1),
    ('Chains', 'Necklaces and chains', 2),
    ('Earrings', 'Stud earrings, drop earrings, hoops', 3),
    ('Pendants', 'Pendant necklaces', 4),
    ('Watches', 'Wrist watches', 5)
END

-- Sample suppliers
IF NOT EXISTS (SELECT * FROM Supplier WHERE SupplierName = 'Australian Jewellers Supply')
BEGIN
    INSERT INTO Supplier (SupplierName, Email, Phone, AddressLine1, City, State, MainContact) VALUES 
    ('Australian Jewellers Supply', 'orders@ajsupply.com.au', '(02) 9876 5432', '45 George Street', 'Sydney', 'NSW', 'John Williams'),
    ('Golden Gate Imports', 'sales@goldengate.com.au', '(03) 8765 4321', '78 Collins Street', 'Melbourne', 'VIC', 'Sarah Chen')
END
'@
    $cmd.ExecuteNonQuery() | Out-Null
    
    Write-Host "Tables and seed data created successfully!"
    $conn.Close()
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    if ($conn -and $conn.State -eq 'Open') { $conn.Close() }
}