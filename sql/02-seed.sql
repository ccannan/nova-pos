-- =============================================================================
-- NovaPOS  —  Reference Data & Sample Items
-- =============================================================================
-- Populates NovaPOS with all lookup tables and the 30 sample item designs.
-- Safe to re-run: every row is inserted only if it doesn't already exist.
--
-- Run AFTER sql\01-schema.sql:
--   sqlcmd -S "localhost\SQLEXPRESS" -C -E -d NovaPOS -i sql\02-seed.sql
--
-- GUIDs are fixed so this script is idempotent and consistent across machines.
-- The ItemStatus and Store GUIDs match the constants used by the test suite.
-- =============================================================================

USE [NovaPOS];
GO

-- ─── ItemStatus ───────────────────────────────────────────────────────────────
-- Fixed GUIDs: 10000001-0000-0000-0000-00000000000n
-- Referenced by InventoryItem.StatusId and hard-coded in server-side models.

IF NOT EXISTS (SELECT 1 FROM ItemStatus WHERE ItemStatusId = '10000001-0000-0000-0000-000000000001')
    INSERT INTO ItemStatus (ItemStatusId, StatusName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('10000001-0000-0000-0000-000000000001', 'Active',      'Available for sale',      1, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM ItemStatus WHERE ItemStatusId = '10000001-0000-0000-0000-000000000002')
    INSERT INTO ItemStatus (ItemStatusId, StatusName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('10000001-0000-0000-0000-000000000002', 'Sold',        'Sold to customer',        1, 2, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM ItemStatus WHERE ItemStatusId = '10000001-0000-0000-0000-000000000003')
    INSERT INTO ItemStatus (ItemStatusId, StatusName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('10000001-0000-0000-0000-000000000003', 'On Hold',     'Reserved for customer',   1, 3, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM ItemStatus WHERE ItemStatusId = '10000001-0000-0000-0000-000000000004')
    INSERT INTO ItemStatus (ItemStatusId, StatusName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('10000001-0000-0000-0000-000000000004', 'Layby',       'On layaway',              1, 4, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM ItemStatus WHERE ItemStatusId = '10000001-0000-0000-0000-000000000005')
    INSERT INTO ItemStatus (ItemStatusId, StatusName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('10000001-0000-0000-0000-000000000005', 'Consignment', 'Consignment item',        1, 5, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM ItemStatus WHERE ItemStatusId = '10000001-0000-0000-0000-000000000006')
    INSERT INTO ItemStatus (ItemStatusId, StatusName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('10000001-0000-0000-0000-000000000006', 'Returned',    'Returned from customer',  1, 6, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM ItemStatus WHERE ItemStatusId = '10000001-0000-0000-0000-000000000007')
    INSERT INTO ItemStatus (ItemStatusId, StatusName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('10000001-0000-0000-0000-000000000007', 'Written Off', 'Written off inventory',   1, 7, GETUTCDATE());

PRINT 'ItemStatus seeded';

-- ─── Store ────────────────────────────────────────────────────────────────────
-- Fixed GUID: 20000001-0000-0000-0000-000000000001
-- Referenced in InventoryItem.StoreId and hard-coded in frontend defaults.

IF NOT EXISTS (SELECT 1 FROM Store WHERE StoreId = '20000001-0000-0000-0000-000000000001')
    INSERT INTO Store (StoreId, StoreName, AddressLine1, City, State, Phone, Email, IsActive, CreatedAt)
    VALUES ('20000001-0000-0000-0000-000000000001', 'Main Store', '123 Main Street', 'Brisbane', 'QLD',
            '(07) 1234 5678', 'orders@novapos.local', 1, GETUTCDATE());

PRINT 'Store seeded';

-- ─── Categories ───────────────────────────────────────────────────────────────
-- GUIDs match production DB so Item rows referencing them stay consistent.

IF NOT EXISTS (SELECT 1 FROM Category WHERE CategoryId = '9FBD22D6-3267-F111-BE34-10A51DA33008')
    INSERT INTO Category (CategoryId, CategoryName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('9FBD22D6-3267-F111-BE34-10A51DA33008', 'Rings',      'Wedding rings, engagement rings, dress rings', 1, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Category WHERE CategoryId = 'A0BD22D6-3267-F111-BE34-10A51DA33008')
    INSERT INTO Category (CategoryId, CategoryName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('A0BD22D6-3267-F111-BE34-10A51DA33008', 'Chains',     'Necklaces and chains',                        1, 2, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Category WHERE CategoryId = 'A1BD22D6-3267-F111-BE34-10A51DA33008')
    INSERT INTO Category (CategoryId, CategoryName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('A1BD22D6-3267-F111-BE34-10A51DA33008', 'Earrings',   'Stud earrings, drop earrings, hoops',         1, 3, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Category WHERE CategoryId = 'A2BD22D6-3267-F111-BE34-10A51DA33008')
    INSERT INTO Category (CategoryId, CategoryName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('A2BD22D6-3267-F111-BE34-10A51DA33008', 'Pendants',   'Pendant necklaces',                           1, 4, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Category WHERE CategoryId = 'A3BD22D6-3267-F111-BE34-10A51DA33008')
    INSERT INTO Category (CategoryId, CategoryName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('A3BD22D6-3267-F111-BE34-10A51DA33008', 'Watches',    'Wrist watches',                               1, 5, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Category WHERE CategoryId = 'E437FEC8-E967-491F-B99F-5D95156405B7')
    INSERT INTO Category (CategoryId, CategoryName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('E437FEC8-E967-491F-B99F-5D95156405B7', 'Bracelets',  'Bangles, tennis bracelets, charm bracelets',  1, 6, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Category WHERE CategoryName = 'Brooches')
    INSERT INTO Category (CategoryName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('Brooches', 'Pins and brooches', 1, 7, GETUTCDATE());

PRINT 'Category seeded';

-- ─── Suppliers ────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM Supplier WHERE SupplierId = 'A4BD22D6-3267-F111-BE34-10A51DA33008')
    INSERT INTO Supplier (SupplierId, SupplierName, Email, Phone, AddressLine1, City, State, MainContact, IsActive, CreatedAt)
    VALUES ('A4BD22D6-3267-F111-BE34-10A51DA33008',
            'Australian Jewellers Supply', 'orders@ajsupply.com.au', '(02) 9876 5432',
            '45 George Street', 'Sydney', 'NSW', 'John Williams', 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Supplier WHERE SupplierId = 'A5BD22D6-3267-F111-BE34-10A51DA33008')
    INSERT INTO Supplier (SupplierId, SupplierName, Email, Phone, AddressLine1, City, State, MainContact, IsActive, CreatedAt)
    VALUES ('A5BD22D6-3267-F111-BE34-10A51DA33008',
            'Golden Gate Imports', 'sales@goldengate.com.au', '(03) 8765 4321',
            '78 Collins Street', 'Melbourne', 'VIC', 'Sarah Chen', 1, GETUTCDATE());

PRINT 'Supplier seeded';

-- ─── Attribute types ──────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM AttribType WHERE AttribTypeId = '09CE7FBB-B367-F111-BE34-10A51DA33008')
    INSERT INTO AttribType (AttribTypeId, AttribTypeName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('09CE7FBB-B367-F111-BE34-10A51DA33008', 'Metal Type',   'Type of metal used',       1, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM AttribType WHERE AttribTypeId = '0ACE7FBB-B367-F111-BE34-10A51DA33008')
    INSERT INTO AttribType (AttribTypeId, AttribTypeName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('0ACE7FBB-B367-F111-BE34-10A51DA33008', 'Stone Type',   'Primary stone or gem',     1, 2, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM AttribType WHERE AttribTypeId = '0BCE7FBB-B367-F111-BE34-10A51DA33008')
    INSERT INTO AttribType (AttribTypeId, AttribTypeName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('0BCE7FBB-B367-F111-BE34-10A51DA33008', 'Carat Weight', 'Weight in carats',         1, 3, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM AttribType WHERE AttribTypeId = '0CCE7FBB-B367-F111-BE34-10A51DA33008')
    INSERT INTO AttribType (AttribTypeId, AttribTypeName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('0CCE7FBB-B367-F111-BE34-10A51DA33008', 'Ring Size',    'Ring size',                1, 4, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM AttribType WHERE AttribTypeId = '0DCE7FBB-B367-F111-BE34-10A51DA33008')
    INSERT INTO AttribType (AttribTypeId, AttribTypeName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('0DCE7FBB-B367-F111-BE34-10A51DA33008', 'Length',       'Chain or bracelet length', 1, 5, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM AttribType WHERE AttribTypeId = '0ECE7FBB-B367-F111-BE34-10A51DA33008')
    INSERT INTO AttribType (AttribTypeId, AttribTypeName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('0ECE7FBB-B367-F111-BE34-10A51DA33008', 'Style',        'Design style',             1, 6, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM AttribType WHERE AttribTypeId = '0FCE7FBB-B367-F111-BE34-10A51DA33008')
    INSERT INTO AttribType (AttribTypeId, AttribTypeName, Description, IsActive, SortOrder, CreatedAt)
    VALUES ('0FCE7FBB-B367-F111-BE34-10A51DA33008', 'Brand',        'Manufacturer or brand',    1, 7, GETUTCDATE());

PRINT 'AttribType seeded';

-- ─── Item designs ─────────────────────────────────────────────────────────────
-- 30 sample jewellery designs across 6 categories.
-- AJS = Australian Jewellers Supply  |  GGI = Golden Gate Imports

-- Rings (6)
IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = 'E0E5646A-927B-4D3F-A04F-62F33468E4FB')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('E0E5646A-927B-4D3F-A04F-62F33468E4FB', 'A4BD22D6-3267-F111-BE34-10A51DA33008', '9FBD22D6-3267-F111-BE34-10A51DA33008',
            'AJS-R001', 'Diamond Solitaire Ring',  1299.00, 620.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '727A1B6F-48E1-477C-BD3A-DA0BEE150F35')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('727A1B6F-48E1-477C-BD3A-DA0BEE150F35', 'A4BD22D6-3267-F111-BE34-10A51DA33008', '9FBD22D6-3267-F111-BE34-10A51DA33008',
            'AJS-R002', 'Sapphire Cluster Ring',    895.00, 420.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = 'E1CD64FD-90A7-42FD-AED7-D0649F3D5570')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('E1CD64FD-90A7-42FD-AED7-D0649F3D5570', 'A4BD22D6-3267-F111-BE34-10A51DA33008', '9FBD22D6-3267-F111-BE34-10A51DA33008',
            'AJS-R003', '9ct Gold Wedding Band',    450.00, 195.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = 'B132BFFB-522F-426B-B2FA-DF528B907CEA')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('B132BFFB-522F-426B-B2FA-DF528B907CEA', 'A4BD22D6-3267-F111-BE34-10A51DA33008', '9FBD22D6-3267-F111-BE34-10A51DA33008',
            'AJS-R004', 'Rose Gold Eternity Ring',  780.00, 360.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '7A68CC27-65EC-4ADB-8F77-12FEB0F5C099')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('7A68CC27-65EC-4ADB-8F77-12FEB0F5C099', 'A5BD22D6-3267-F111-BE34-10A51DA33008', '9FBD22D6-3267-F111-BE34-10A51DA33008',
            'GGI-R001', 'Emerald Halo Ring',       1650.00, 790.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '5627935B-3A20-47CB-B124-B5629468FC27')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('5627935B-3A20-47CB-B124-B5629468FC27', 'A5BD22D6-3267-F111-BE34-10A51DA33008', '9FBD22D6-3267-F111-BE34-10A51DA33008',
            'GGI-R002', 'Platinum Diamond Band',   2200.00,1050.00, 1, GETUTCDATE());

-- Chains (5)
IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '132437B3-B511-48A8-939E-1B54E243DFAD')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('132437B3-B511-48A8-939E-1B54E243DFAD', 'A4BD22D6-3267-F111-BE34-10A51DA33008', 'A0BD22D6-3267-F111-BE34-10A51DA33008',
            'AJS-C001', '18ct Gold Belcher Chain',  320.00, 140.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '953E0027-336F-4732-B72F-F61A9FAB6451')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('953E0027-336F-4732-B72F-F61A9FAB6451', 'A4BD22D6-3267-F111-BE34-10A51DA33008', 'A0BD22D6-3267-F111-BE34-10A51DA33008',
            'AJS-C002', 'Sterling Silver Figaro Chain', 95.00,  38.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '5291B2C1-AA64-4D50-90E1-3FF74FB366F6')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('5291B2C1-AA64-4D50-90E1-3FF74FB366F6', 'A4BD22D6-3267-F111-BE34-10A51DA33008', 'A0BD22D6-3267-F111-BE34-10A51DA33008',
            'AJS-C003', 'Diamond-Cut Rope Chain',   420.00, 185.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '95ECF865-1750-41C5-A351-ECE408DD1863')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('95ECF865-1750-41C5-A351-ECE408DD1863', 'A5BD22D6-3267-F111-BE34-10A51DA33008', 'A0BD22D6-3267-F111-BE34-10A51DA33008',
            'GGI-C001', 'Gold Curb Chain',          275.00, 120.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = 'C36F97F2-434F-4BC9-9954-F74875C87D58')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('C36F97F2-434F-4BC9-9954-F74875C87D58', 'A5BD22D6-3267-F111-BE34-10A51DA33008', 'A0BD22D6-3267-F111-BE34-10A51DA33008',
            'GGI-C002', 'Rose Gold Trace Chain',    185.00,  80.00, 1, GETUTCDATE());

-- Earrings (6)
IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = 'EA0B409A-3418-4E05-920B-9B185CD0E3A5')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('EA0B409A-3418-4E05-920B-9B185CD0E3A5', 'A4BD22D6-3267-F111-BE34-10A51DA33008', 'A1BD22D6-3267-F111-BE34-10A51DA33008',
            'AJS-E001', 'Diamond Stud Earrings',    599.00, 280.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '1CDADDE6-9C09-4BC8-BFAA-CC09407433C0')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('1CDADDE6-9C09-4BC8-BFAA-CC09407433C0', 'A4BD22D6-3267-F111-BE34-10A51DA33008', 'A1BD22D6-3267-F111-BE34-10A51DA33008',
            'AJS-E002', 'Pearl Drop Earrings',      340.00, 145.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '7CF6C014-4467-40D6-BBEC-A59C764AF424')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('7CF6C014-4467-40D6-BBEC-A59C764AF424', 'A4BD22D6-3267-F111-BE34-10A51DA33008', 'A1BD22D6-3267-F111-BE34-10A51DA33008',
            'AJS-E003', 'Gold Huggie Earrings',     195.00,  85.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '22BAA2E0-4096-4DA6-AB68-DE589884B22F')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('22BAA2E0-4096-4DA6-AB68-DE589884B22F', 'A5BD22D6-3267-F111-BE34-10A51DA33008', 'A1BD22D6-3267-F111-BE34-10A51DA33008',
            'GGI-E001', 'Gold Hoop Earrings',       220.00,  95.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '5EDF6026-FBA7-4050-9F9F-BBCAD0336C68')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('5EDF6026-FBA7-4050-9F9F-BBCAD0336C68', 'A5BD22D6-3267-F111-BE34-10A51DA33008', 'A1BD22D6-3267-F111-BE34-10A51DA33008',
            'GGI-E002', 'Sapphire Stud Earrings',   480.00, 220.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = 'F0F5425F-062A-4476-875C-9419C9E6B063')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('F0F5425F-062A-4476-875C-9419C9E6B063', 'A5BD22D6-3267-F111-BE34-10A51DA33008', 'A1BD22D6-3267-F111-BE34-10A51DA33008',
            'GGI-E003', 'Diamond Drop Earrings',   1150.00, 540.00, 1, GETUTCDATE());

-- Pendants (5)
IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = 'E9F364E1-15C2-4C05-9D1E-3A3D02D970F5')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('E9F364E1-15C2-4C05-9D1E-3A3D02D970F5', 'A4BD22D6-3267-F111-BE34-10A51DA33008', 'A2BD22D6-3267-F111-BE34-10A51DA33008',
            'AJS-P001', 'Diamond Heart Pendant',    680.00, 310.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '9FA534C9-FD8C-4DCE-A5ED-3151581BB7D1')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('9FA534C9-FD8C-4DCE-A5ED-3151581BB7D1', 'A4BD22D6-3267-F111-BE34-10A51DA33008', 'A2BD22D6-3267-F111-BE34-10A51DA33008',
            'AJS-P002', 'Gold Star Pendant',        210.00,  90.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '729544A1-BA10-4D35-A6A6-39FB9ABC9AAA')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('729544A1-BA10-4D35-A6A6-39FB9ABC9AAA', 'A4BD22D6-3267-F111-BE34-10A51DA33008', 'A2BD22D6-3267-F111-BE34-10A51DA33008',
            'AJS-P003', 'Infinity Pendant',         290.00, 125.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '3665BCF4-43F2-4B5C-B13D-1337B978A72E')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('3665BCF4-43F2-4B5C-B13D-1337B978A72E', 'A5BD22D6-3267-F111-BE34-10A51DA33008', 'A2BD22D6-3267-F111-BE34-10A51DA33008',
            'GGI-P001', 'Gold Cross Pendant',       145.00,  60.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '762EBF9C-0E34-4174-BAB2-2B4AD4924A0D')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('762EBF9C-0E34-4174-BAB2-2B4AD4924A0D', 'A5BD22D6-3267-F111-BE34-10A51DA33008', 'A2BD22D6-3267-F111-BE34-10A51DA33008',
            'GGI-P002', 'Sapphire Teardrop Pendant',520.00, 240.00, 1, GETUTCDATE());

-- Watches (4)
IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '2B645BC1-C9FD-4AF0-8262-406E285F3263')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('2B645BC1-C9FD-4AF0-8262-406E285F3263', 'A4BD22D6-3267-F111-BE34-10A51DA33008', 'A3BD22D6-3267-F111-BE34-10A51DA33008',
            'AJS-W001', 'Ladies Rose Gold Watch',   720.00, 340.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '82223EF8-EF80-4EAF-9159-9EEF6FB58885')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('82223EF8-EF80-4EAF-9159-9EEF6FB58885', 'A4BD22D6-3267-F111-BE34-10A51DA33008', 'A3BD22D6-3267-F111-BE34-10A51DA33008',
            'AJS-W002', 'Gold Chronograph Watch',  1200.00, 575.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = 'B669E002-6993-4568-96EA-F11AF9C1F998')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('B669E002-6993-4568-96EA-F11AF9C1F998', 'A5BD22D6-3267-F111-BE34-10A51DA33008', 'A3BD22D6-3267-F111-BE34-10A51DA33008',
            'GGI-W001', 'Men''s Gold Dress Watch',  850.00, 410.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = 'DB2C3E54-6B10-4CEA-8BBC-77F3FCBAE395')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('DB2C3E54-6B10-4CEA-8BBC-77F3FCBAE395', 'A5BD22D6-3267-F111-BE34-10A51DA33008', 'A3BD22D6-3267-F111-BE34-10A51DA33008',
            'GGI-W002', 'Silver Dress Watch',       495.00, 230.00, 1, GETUTCDATE());

-- Bracelets (4)
IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '1223B162-63CE-4944-8A9F-A5A27454647C')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('1223B162-63CE-4944-8A9F-A5A27454647C', 'A4BD22D6-3267-F111-BE34-10A51DA33008', 'E437FEC8-E967-491F-B99F-5D95156405B7',
            'AJS-B001', 'Gold Tennis Bracelet',     950.00, 450.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '4C9D3E55-C833-46DB-B459-E58C8C6358A6')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('4C9D3E55-C833-46DB-B459-E58C8C6358A6', 'A4BD22D6-3267-F111-BE34-10A51DA33008', 'E437FEC8-E967-491F-B99F-5D95156405B7',
            'AJS-B002', 'Diamond Bangle',          1450.00, 690.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '70472268-6A2F-41F3-AED4-46004A355CCD')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('70472268-6A2F-41F3-AED4-46004A355CCD', 'A5BD22D6-3267-F111-BE34-10A51DA33008', 'E437FEC8-E967-491F-B99F-5D95156405B7',
            'GGI-B001', 'Silver Charm Bracelet',   175.00,  72.00, 1, GETUTCDATE());

IF NOT EXISTS (SELECT 1 FROM Item WHERE ItemId = '07483527-7C63-452B-A62C-0EFF7A3A05A7')
    INSERT INTO Item (ItemId, SupplierId, CategoryId, DesignNo, Description, RetailPrice, Cost, IsActive, CreatedAt)
    VALUES ('07483527-7C63-452B-A62C-0EFF7A3A05A7', 'A5BD22D6-3267-F111-BE34-10A51DA33008', 'E437FEC8-E967-491F-B99F-5D95156405B7',
            'GGI-B002', 'Rose Gold Bracelet',       390.00, 168.00, 1, GETUTCDATE());

PRINT '';
PRINT '02-seed.sql complete.';
PRINT '  ItemStatus : 7 rows';
PRINT '  Store      : 1 row  (Main Store)';
PRINT '  Category   : 7 rows';
PRINT '  Supplier   : 2 rows';
PRINT '  AttribType : 7 rows';
PRINT '  Item       : 30 designs';
