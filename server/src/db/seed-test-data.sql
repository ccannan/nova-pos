-- NovaPosTEST Seeding Script
-- Ensures all lookup data exists with fixed GUIDs matching test constants

-- ====================================
-- ItemStatus (fixed GUIDs)
-- ====================================
IF NOT EXISTS (SELECT * FROM ItemStatus)
BEGIN
    INSERT INTO ItemStatus (ItemStatusId, StatusName, Description, SortOrder, IsActive, CreatedAt) VALUES
    ('10000001-0000-0000-0000-000000000001', 'Active', 'Available for sale', 1, 1, GETUTCDATE()),
    ('10000001-0000-0000-0000-000000000002', 'Sold', 'Sold to customer', 2, 1, GETUTCDATE()),
    ('10000001-0000-0000-0000-000000000003', 'On Hold', 'Reserved for customer', 3, 1, GETUTCDATE()),
    ('10000001-0000-0000-0000-000000000004', 'Layby', 'On layaway', 4, 1, GETUTCDATE()),
    ('10000001-0000-0000-0000-000000000005', 'Consignment', 'Consignment item', 5, 1, GETUTCDATE()),
    ('10000001-0000-0000-0000-000000000006', 'Returned', 'Returned from customer', 6, 1, GETUTCDATE()),
    ('10000001-0000-0000-0000-000000000007', 'Written Off', 'Written off inventory', 7, 1, GETUTCDATE());
END

-- ====================================
-- Store (fixed GUID)
-- ====================================
IF NOT EXISTS (SELECT * FROM Store)
BEGIN
    INSERT INTO Store (StoreId, StoreName, AddressLine1, City, State, Phone, Email, IsActive, CreatedAt) VALUES
    ('20000001-0000-0000-0000-000000000001', 'Main Store', '123 Main Street', 'Brisbane', 'QLD', '(07) 1234 5678', 'orders@novapos.local', 1, GETUTCDATE());
END

-- ====================================
-- Category
-- ====================================
IF NOT EXISTS (SELECT * FROM Category)
BEGIN
    INSERT INTO Category (CategoryName, Description, SortOrder, IsActive, CreatedAt) VALUES
    ('Rings', 'Wedding rings, engagement rings, dress rings', 1, 1, GETUTCDATE()),
    ('Chains', 'Necklaces and chains', 2, 1, GETUTCDATE()),
    ('Earrings', 'Stud earrings, drop earrings, hoops', 3, 1, GETUTCDATE()),
    ('Pendants', 'Pendant necklaces', 4, 1, GETUTCDATE()),
    ('Watches', 'Wrist watches', 5, 1, GETUTCDATE()),
    ('Brooches', 'Pins and brooches', 6, 1, GETUTCDATE());
END

-- ====================================
-- Supplier
-- ====================================
IF NOT EXISTS (SELECT * FROM Supplier)
BEGIN
    INSERT INTO Supplier (SupplierId, SupplierName, Email, Phone, AddressLine1, City, State, MainContact, IsActive, CreatedAt) VALUES
    (NEWID(), 'Australian Jewellers Supply', 'orders@ajsupply.com.au', '(02) 9876 5432', '45 George Street', 'Sydney', 'NSW', 'John Williams', 1, GETUTCDATE()),
    (NEWID(), 'Golden Gate Imports', 'sales@goldengate.com.au', '(03) 8765 4321', '78 Collins Street', 'Melbourne', 'VIC', 'Sarah Chen', 1, GETUTCDATE());
END

-- ====================================
-- AttribType
-- ====================================
IF NOT EXISTS (SELECT * FROM AttribType)
BEGIN
    INSERT INTO AttribType (AttribTypeName, Description, SortOrder, IsActive, CreatedAt) VALUES
    ('Metal Type', 'Type of metal used', 1, 1, GETUTCDATE()),
    ('Stone Type', 'Primary stone or gem', 2, 1, GETUTCDATE()),
    ('Carat Weight', 'Weight in carats', 3, 1, GETUTCDATE()),
    ('Ring Size', 'Ring size', 4, 1, GETUTCDATE()),
    ('Length', 'Chain or bracelet length', 5, 1, GETUTCDATE()),
    ('Style', 'Design style', 6, 1, GETUTCDATE()),
    ('Brand', 'Manufacturer or brand', 7, 1, GETUTCDATE());
END

PRINT 'NovaPosTEST seeded successfully';