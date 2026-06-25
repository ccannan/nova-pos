// server/src/queue/processor.js
// Background service: replays queued sale operations to the DB.
// Each queue file contains a complete, self-contained sale. On each tick:
//   - Every INSERT is idempotent: check row existence by PK before inserting.
//   - All ops succeed → move to processed/ (retained for audit).
//   - Any op fails → increment retryCount, stamp lastAttemptAt, leave in pending/.
//   - retryCount >= MAX_RETRIES → move to failed/ and log.

const fs   = require('fs');
const path = require('path');
const { query } = require('../db/connection');
const saleModel  = require('../models/sale.model');

const QUEUE_DIR     = process.env.QUEUE_DIR           || path.join(__dirname, '..', '..', 'tests', 'tmp', 'queue');
const PENDING_DIR   = path.join(QUEUE_DIR, 'pending');
const PROCESSED_DIR = path.join(QUEUE_DIR, 'processed');
const FAILED_DIR    = path.join(QUEUE_DIR, 'failed');

const MAX_RETRIES   = Number(process.env.QUEUE_MAX_RETRIES    || 10);
const POLL_INTERVAL = Number(process.env.QUEUE_POLL_INTERVAL_MS || 30000);

// Maps table name → its primary key column name.
const TABLE_PKS = {
    Sale:             'SaleId',
    SaleLine:         'SaleLineId',
    SaleTender:       'SaleTenderId',
    InventoryHistory: 'InventoryHistoryId',
    InventoryItem:    'InventoryItemId',
};

function ensureDirs() {
    for (const d of [PENDING_DIR, PROCESSED_DIR, FAILED_DIR]) {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    }
}

function moveFile(name, fromDir, toDir) {
    fs.renameSync(path.join(fromDir, name), path.join(toDir, name));
}

// Execute a single INSERT operation from the queue.
// Checks for row existence first so replaying a file is safe even if some
// rows were written in a previous partial attempt.
async function executeInsertOp(op) {
    const pkCol = TABLE_PKS[op.table];
    if (!pkCol) throw new Error(`Unknown table in queue op: ${op.table}`);

    const data  = { ...op.data };
    const pkVal = data[pkCol];

    // Sale rows need a SaleNumber; it may be null when the DB was down at sale time.
    if (op.table === 'Sale' && (data.SaleNumber == null)) {
        data.SaleNumber = await saleModel.getNextSaleNumber(data.StoreId);
    }

    // Idempotency check: skip if the row is already in the DB.
    if (pkVal) {
        const check = await query(
            `SELECT ${pkCol} FROM ${op.table} WHERE ${pkCol} = @PkValue`,
            { PkValue: pkVal }
        );
        if (check.recordset.length > 0) return;
    }

    // Validate parent Sale exists for child tables (mirrors FK constraint).
    if (op.table !== 'Sale' && data.SaleId) {
        const saleCheck = await query(
            'SELECT SaleId FROM Sale WHERE SaleId = @RefSaleId',
            { RefSaleId: data.SaleId }
        );
        if (!saleCheck.recordset[0]) {
            throw new Error(`Referenced Sale not found: ${data.SaleId}`);
        }
    }

    // Build and execute INSERT from the data object.
    const columns = Object.keys(data).filter(k => data[k] !== undefined);
    const colList = columns.join(', ');
    const valList = columns.map(c => `@${c}`).join(', ');
    const params  = {};
    for (const col of columns) params[col] = data[col];

    await query(
        `INSERT INTO ${op.table} (${colList}) VALUES (${valList})`,
        params
    );
}

// Process all pending queue files. Called on each timer tick and at startup.
async function processTick() {
    ensureDirs();
    const files = fs.readdirSync(PENDING_DIR).filter(f => f.endsWith('.json'));

    for (const name of files) {
        const filePath = path.join(PENDING_DIR, name);
        let envelope;
        try {
            envelope = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (parseErr) {
            console.error(`[queue] Failed to parse ${name}:`, parseErr.message);
            continue;
        }

        let failed = false;
        for (const op of (envelope.operations || [])) {
            try {
                if (op.operation === 'INSERT') {
                    await executeInsertOp(op);
                }
                // Future: handle UPDATE ops here
            } catch (opErr) {
                console.error(`[queue] Op failed in ${name} (${op.step || op.table}):`, opErr.message);
                failed = true;
                break;
            }
        }

        if (!failed) {
            moveFile(name, PENDING_DIR, PROCESSED_DIR);
            console.log(`[queue] Processed: ${name}`);
        } else {
            const newCount = (envelope.retryCount || 0) + 1;
            if (newCount >= MAX_RETRIES) {
                moveFile(name, PENDING_DIR, FAILED_DIR);
                console.error(`[queue] Exhausted retries, moved to failed/: ${name}`);
            } else {
                envelope.retryCount    = newCount;
                envelope.lastAttemptAt = new Date().toISOString();
                fs.writeFileSync(filePath, JSON.stringify(envelope, null, 2), 'utf8');
                console.warn(`[queue] Retry ${newCount}/${MAX_RETRIES} for ${name}`);
            }
        }
    }
}

// Start the polling timer. Call once at server startup.
let _timer = null;
function start() {
    if (_timer) return;
    processTick().catch(err => console.error('[queue] startup tick error:', err.message));
    _timer = setInterval(() => {
        processTick().catch(err => console.error('[queue] tick error:', err.message));
    }, POLL_INTERVAL);
}

function stop() {
    if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { processTick, start, stop };
