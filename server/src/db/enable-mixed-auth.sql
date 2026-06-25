DECLARE @cmd varchar(500);
SET @cmd = 'reg add "HKLM\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL17.SQLEXPRESS\MSSQLServer" /v LoginMode /t REG_DWORD /d 2 /f';
EXEC xp_cmdshell @cmd;
GO
PRINT 'Registry updated';