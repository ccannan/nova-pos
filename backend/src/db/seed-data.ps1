# NovaPOS Seed Data Script
param(
    [string]$server = "localhost\SQLEXPRESS",
    [string]$database = "NovaPOS"
)

Add-Type -AssemblyName System.Data

try {
    Write-Host "Connecting to NovaPOS database..."
    
    $connStr = "Server=$server;Database=$database;Trusted_Connection=True;TrustServerCertificate=True;"
    $conn = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $conn.Open()
    Write-Host "Connected successfully"
    
    $cmd = $conn.CreateCommand()
    $cmd.CommandTimeout = 60
    
    # First, let's check what tables exist
    Write-Host "Checking existing tables..."
    $cmd.CommandText = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
    $reader = $cmd.ExecuteReader()
    
    Write-Host "Existing tables:"
    while ($reader.Read()) {
        Write-Host "  $($reader['TABLE_NAME'])"
    }
    $reader.Close()
    
    # Create remaining tables that don't exist
    Write-Host "Creating any missing tables..."
    
    # ItemStatus seed data
    Write-Host "Seeding ItemStatus table..."
    $cmd.CommandText = @"
IF NOT EXISTS (SELECT * FROM ItemStatus WHERE StatusName = 'Active')
BEGIN
    INSERT INTO ItemStatus (StatusName, Description, SortOrder) VALUES 
    ('Active', 'Available for sale', 1),
    ('Sold', 'Sold to customer', 2),
    ('On Hold', 'Reserved for customer', 3),
    ('Layby', 'On layaway', 4),
    ('Consignment', 'Consignment item', 5),
    ('Returned', 'Returned from customer', 6),
    ('Written Off', 'Written off inventory', 7)
    PRINT 'ItemStatus seed data inserted'
END
"@
    $cmd.ExecuteNonQuery() | Out-Null
    
    # Create a default store
    Write-Host "Creating default store..."
    $cmd.CommandText = @"
IF NOT EXISTS (SELECT * FROM Store WHERE StoreName = 'Main Store')
BEGIN
    INSERT INTO Store (StoreName, AddressLine1, City, State, Phone, Email) VALUES 
    ('Main Store', '123 Main Street', 'Brisbane', 'QLD', '(07) 1234 5678', 'orders@novapos.local')
    PRINT 'Default store created'
END
"@
    $cmd.ExecuteNonQuery() | Out-Null
    
    # Create sample categories
    Write-Host "Creating sample categories..."
    $cmd.CommandText = @"
IF NOT EXISTS (SELECT * FROM Category WHERE CategoryName = 'Rings')
BEGIN
    INSERT INTO Category (CategoryName, Description, SortOrder) VALUES 
    ('Rings', 'Wedding rings, engagement rings, dress rings', 1),
    ('Chains', 'Necklaces and chains', 2),
    ('Earrings', 'Stud earrings, drop earrings, hoops', 3),
    ('Pendants', 'Pendant necklaces', 4),
    ('Watches', 'Wrist watches', 5),
    ('Brooches', 'Pins and brooches', 6)
    PRINT 'Sample categories created'
END
"@
    $cmd.ExecuteNonQuery() | Out-Null
    
    # Create sample attribute types
    Write-Host "Creating sample attribute types..."
    $cmd.CommandText = @"
IF NOT EXISTS (SELECT * FROM AttribType WHERE AttribTypeName = 'Metal Type')
BEGIN
    INSERT INTO AttribType (AttribTypeName, Description, SortOrder) VALUES 
    ('Metal Type', 'Type of metal used', 1),
    ('Stone Type', 'Primary stone or gem', 2),
    ('Carat Weight', 'Weight in carats', 3),
    ('Ring Size', 'Ring size', 4),
    ('Length', 'Chain or bracelet length', 5),
    ('Style', 'Design style', 6),
    ('Brand', 'Manufacturer or brand', 7)
    PRINT 'Sample attribute types created'
END
"@
    $cmd.ExecuteNonQuery() | Out-Null
    
    Write-Host "Seed data creation completed successfully!"
    
    $conn.Close()
    
} catch {
    Write-Error "Database error: $($_.Exception.Message)"
    exit 1
} finally {
    if ($conn) { $conn.Close() }
}