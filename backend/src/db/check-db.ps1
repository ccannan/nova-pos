# Check NovaPOS Database Tables
param([string]$server = "localhost\SQLEXPRESS", [string]$database = "NovaPOS")

Add-Type -AssemblyName System.Data

try {
    $conn = New-Object System.Data.SqlClient.SqlConnection("Server=$server;Database=$database;Trusted_Connection=True;")
    $conn.Open()
    $cmd = $conn.CreateCommand()
    
    $cmd.CommandText = "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
    $reader = $cmd.ExecuteReader()
    
    Write-Host "Tables in NovaPOS database:"
    while ($reader.Read()) {
        Write-Host "  $($reader['TABLE_NAME'])"
    }
    $reader.Close()
    
    $cmd.CommandText = "SELECT COUNT(*) as cnt FROM ItemStatus"
    $reader = $cmd.ExecuteReader()
    $reader.Read()
    Write-Host "ItemStatus records: $($reader['cnt'])"
    $reader.Close()
    
    $conn.Close()
} catch {
    Write-Error $_.Exception.Message
}