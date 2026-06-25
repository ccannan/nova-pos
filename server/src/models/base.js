// server/src/models/base.js
// Shared database helpers for all models.
// Uses the sqlcmd bridge for all queries (bypasses mssql/tedious NTLM issues).

const { query: dbQuery } = require('../db/connection');

/**
 * Query helper — delegates to the sqlcmd bridge via connection.js.
 * Returns { recordset, rowsAffected } matching mssql's interface.
 * @param {string} text SQL with @named parameters
 * @param {Object} [params] map of param name → value
 * @returns {Promise<{ recordset: Array, rowsAffected: number[] }>}
 */
async function query(text, params = {}) {
    return dbQuery(text, params);
}

/**
 * Insert a row and return it by re-selecting on its PK.
 * @param {string} table
 * @param {string} pkColumn
 * @param {Object} row fully-resolved column → value map
 * @returns {Promise<Object>} the inserted row from the DB
 */
async function insertAndReturn(table, pkColumn, row) {
    const columns = Object.keys(row);
    const colList = columns.join(', ');
    const valList = columns.map(c => `@${c}`).join(', ');
    await query(`INSERT INTO ${table} (${colList}) VALUES (${valList})`, row);
    const res = await query(`SELECT * FROM ${table} WHERE ${pkColumn} = @pk`, { pk: row[pkColumn] });
    return res.recordset[0];
}

/**
 * Generate a UUID v4 string.
 */
function uuid() {
    const { randomUUID } = require('crypto');
    return randomUUID();
}

module.exports = { query, insertAndReturn, uuid };