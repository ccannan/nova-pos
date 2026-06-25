// server/src/db/connection.js
// Database bridge using sqlcmd.exe with Windows Integrated Auth.
// Provides an mssql-compatible interface ({ recordset, rowsAffected }).

require('dotenv').config();
const { execute } = require('./sqlBridge');

/**
 * Run a parameterised SQL query via sqlcmd bridge.
 * Inlines @named parameters into the SQL text since sqlcmd doesn't support
 * prepared statements.
 * @param {string} text SQL with @named parameters
 * @param {Object} [params] map of param name → value
 * @returns {Promise<{ recordset: Array, rowsAffected: number[] }>}
 */
async function query(text, params = {}) {
    // Inline parameters into SQL (simple approach for UUIDs, strings, numbers)
    let sql = text;
    for (const [key, value] of Object.entries(params)) {
        const placeholder = `@${key}`;
        let replacement;
        if (value === null || value === undefined) {
            replacement = 'NULL';
        } else if (typeof value === 'string') {
            // Escape single quotes by doubling them
            replacement = `'${value.replace(/'/g, "''")}'`;
        } else if (typeof value === 'boolean') {
            replacement = value ? '1' : '0';
        } else if (typeof value === 'number') {
            replacement = String(value);
        } else if (value instanceof Date) {
            // Convert to SQL Server-friendly format: YYYY-MM-DD HH:MM:SS.mmm
            const pad = (n) => String(n).padStart(2, '0');
            const ms = String(value.getUTCMilliseconds()).padStart(3, '0');
            replacement = `'${value.getUTCFullYear()}-${pad(value.getUTCMonth()+1)}-${pad(value.getUTCDate())} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}.${ms}'`;
        } else {
            replacement = `'${String(value).replace(/'/g, "''")}'`;
        }
        // Replace ALL occurrences of the parameter
        sql = sql.split(placeholder).join(replacement);
    }

    const result = execute(sql);
    if (result.error) {
        throw new Error(result.error);
    }
    return { recordset: result.rows, rowsAffected: [result.rowsAffected || 0] };
}

module.exports = { query };