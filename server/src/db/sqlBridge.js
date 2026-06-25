// server/src/db/sqlBridge.js
// SQL Server bridge using sqlcmd.exe with Windows Integrated Auth.
// Bypasses Node.js mssql/tedious auth issues against SQL Server 2025.
// Uses same approach as the existing backend/src/config/sqlBridge.ts.

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const DB_SERVER = process.env.DB_SERVER || 'localhost';
const DB_PORT = process.env.DB_PORT || '1433';

/**
 * Execute a SQL file via sqlcmd and return parsed JSON results.
 * @param {string} sqlFile - Path to .sql file
 * @returns {{ rows: Array, error: string|null }}
 */
function executeFile(sqlFile) {
    const cmd = `sqlcmd -S "${DB_SERVER}" -C -E -d "${process.env.DB_NAME || 'NovaPOS'}" -i "${sqlFile}" -W -s "|"`;
    try {
        const output = execSync(cmd, { timeout: 30000, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).trim();
        return { rows: parseSqlcmdOutput(output), error: null };
    } catch (err) {
        return { rows: [], error: err.stderr || err.message || 'Unknown sqlcmd error' };
    }
}

/**
 * Execute a raw SQL string via sqlcmd.
 * @param {string} sql
 * @returns {{ rows: Array, error: string|null }}
 */
function execute(sql, database) {
    const tmpFile = path.join(os.tmpdir(), `nova_query_${Date.now()}_${Math.random().toString(36).slice(2,8)}.sql`);
    const db = database || process.env.DB_NAME || 'NovaPOS';
    try {
        fs.writeFileSync(tmpFile, sql, 'utf8');
        const cmd = `sqlcmd -S "${DB_SERVER}" -C -E -d "${db}" -i "${tmpFile}" -W -s "|" 2>&1`;
        const output = execSync(cmd, { timeout: 30000, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
        const rows = parseSqlcmdOutput(output.trim());
        const raMatch = output.match(/\((\d+)\s+rows?\s+affected\)/i);
        const rowsAffected = raMatch ? parseInt(raMatch[1], 10) : 0;
        return { rows, rowsAffected, error: null };
    } catch (err) {
        let detail = '';
        if (err.stderr) detail = err.stderr.toString().trim();
        else if (err.stdout) detail = err.stdout.toString().trim();
        else detail = err.message || 'Unknown error';
        return { rows: [], error: `${detail} (exit: ${err.status ?? '?'})` };
    } finally {
        try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
}

/**
 * Execute SELECT and return first row (or null).
 */
function executeFirst(sql, database) {
    const result = execute(sql, database);
    if (result.error) throw new Error(result.error);
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Execute SELECT and return all rows.
 */
function executeAll(sql, database) {
    const result = execute(sql, database);
    if (result.error) throw new Error(result.error);
    return result.rows;
}

/**
 * Parse sqlcmd -W -s "|" output into array of row objects.
 * sqlcmd with -W -s "|" produces pipe-delimited rows:
 *   col1|col2|col3
 *   val1|val2|val3
 *   --- separator line
 *   (N rows affected)
 */
function parseSqlcmdOutput(output) {
    if (!output) return [];

    const lines = output.split('\n')
        .map(l => l.replace(/\r$/, '').trim())
        .filter(l => l && !l.startsWith('(') && !l.startsWith('-') && !l.startsWith('Sqlcmd:'));

    if (lines.length < 2) return [];  // Need at least header + 1 data row

    const headers = lines[0].split('|').map(h => h.trim());
    const dataLines = lines.slice(1).filter(l => l);  // skip empty

    return dataLines.map(line => {
        const values = line.split('|').map(v => v.trim());
        const row = {};
        headers.forEach((h, i) => {
            let val = values[i] !== undefined ? values[i] : null;
            if (val === 'NULL' || val === '') val = null;
            // Auto-convert bit columns (IsActive, IsDeleted, IsPrimary, etc.) to booleans
            if (val !== null && /^[01]$/.test(val) && /^Is/i.test(h)) {
                val = val === '1';
            }
            row[h] = val;
        });
        return row;
    });
}

module.exports = { execute, executeFirst, executeAll, executeFile };