// tests/helpers/db-test.js
// Test database connection helper using sqlcmd bridge.
// Uses the same approach as the production connection but points at NovaPosTEST.

require('dotenv').config({ path: require('path').join(__dirname, '../../.env.test') });

const bridge = require('../../src/db/sqlBridge');

let connected = false;

const DB_NAME = process.env.DB_NAME || 'NovaPosTEST';

/**
 * "Connect" to the test database (no-op — sqlcmd connects per-query).
 */
async function connect() {
    // Verify connectivity with a test query
    const result = bridge.execute('SELECT 1 AS ok', DB_NAME);
    if (result.error) {
        throw new Error(`Test DB connection failed: ${result.error}`);
    }
    connected = true;
    return true;
}

/**
 * "Close" the test database connection (no-op for sqlcmd bridge).
 */
async function close() {
    connected = false;
}

/**
 * Run a parameterised query against the test DB.
 * Inlines @named parameters into SQL text.
 * @param {string} text SQL with @named parameters
 * @param {Object} [params] map of param name → value
 * @returns {Promise<{ recordset: Array }>}
 */
async function query(text, params = {}) {
    let sql = text;
    for (const [key, value] of Object.entries(params)) {
        const placeholder = `@${key}`;
        let replacement;
        if (value === null || value === undefined) {
            replacement = 'NULL';
        } else if (typeof value === 'string') {
            replacement = `'${value.replace(/'/g, "''")}'`;
        } else if (typeof value === 'boolean') {
            replacement = value ? '1' : '0';
        } else if (typeof value === 'number') {
            replacement = String(value);
        } else if (value instanceof Date) {
            // SQL Server-friendly format: YYYY-MM-DD HH:MM:SS.mmm
            const pad = (n) => String(n).padStart(2, '0');
            const ms = String(value.getUTCMilliseconds()).padStart(3, '0');
            replacement = `'${value.getUTCFullYear()}-${pad(value.getUTCMonth()+1)}-${pad(value.getUTCDate())} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}.${ms}'`;
        } else {
            replacement = `'${String(value).replace(/'/g, "''")}'`;
        }
        sql = sql.split(placeholder).join(replacement);
    }

    const result = bridge.execute(sql, DB_NAME);
    if (result.error) {
        throw new Error(result.error);
    }
    return { recordset: result.rows };
}

module.exports = { connect, close, query };