const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const db = require('../helpers/db-test');
const { seedSale, clearAll } = require('../helpers/seeds');

// The queue processor is an internal service (no HTTP routes). It reads files
// from pending/, attempts each operation, and moves the file to processed/ (all
// succeed) or failed/ (retryCount > QUEUE_MAX_RETRIES).
//
// Module path assumed from inventory.md: server/src/queue/processor.js exposing
// a single-tick function. The exact export name is not specified in the
// contracts — `processTick` is assumed. See spec-ambiguity note in summary.
const processor = require('../../src/queue/processor');

const QUEUE_DIR = process.env.QUEUE_DIR || path.join(__dirname, '..', 'tmp', 'queue');
const PENDING_DIR = path.join(QUEUE_DIR, 'pending');
const PROCESSED_DIR = path.join(QUEUE_DIR, 'processed');
const FAILED_DIR = path.join(QUEUE_DIR, 'failed');

const MAX_RETRIES = Number(process.env.QUEUE_MAX_RETRIES || 10);

function ensureDirs() {
  for (const d of [PENDING_DIR, PROCESSED_DIR, FAILED_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

function cleanQueueDir() {
  for (const d of [PENDING_DIR, PROCESSED_DIR, FAILED_DIR]) {
    if (fs.existsSync(d)) {
      for (const f of fs.readdirSync(d)) fs.rmSync(path.join(d, f), { force: true });
    }
  }
}

function writeQueueFile(dir, name, body) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(body, null, 2));
  return name;
}

describe('Queue Processor — server/src/queue/processor.js', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.close(); });
  beforeEach(() => { ensureDirs(); });
  afterEach(async () => {
    jest.restoreAllMocks();
    cleanQueueDir();
    await clearAll();
  });

  // ─── Retry to processed ───────────────────────────────────────────────────────

  describe('successful processing', () => {
    it('writes the row and moves the file from pending/ to processed/', async () => {
      // Sale row already exists; queue a SaleTender INSERT for it.
      const sale = await seedSale();
      const tenderId = randomUUID();
      const name = `2026-06-13T10-30-00-000Z-${randomUUID()}.json`;
      writeQueueFile(PENDING_DIR, name, {
        queueId: randomUUID(),
        createdAt: '2026-06-13T10:30:00Z',
        retryCount: 0,
        lastAttemptAt: null,
        operations: [
          {
            step: 'INSERT_SALE_TENDER',
            table: 'SaleTender',
            operation: 'INSERT',
            data: {
              SaleTenderId: tenderId,
              SaleId: sale.SaleId,
              TenderMethod: 'Cash',
              Amount: 1299.0,
              Reference: null,
              Status: 'Active',
            },
          },
        ],
      });

      await processor.processTick();

      const row = await db.query(
        'SELECT * FROM SaleTender WHERE SaleTenderId = @id',
        { id: tenderId }
      );
      expect(row.recordset.length).toBe(1);
      expect(fs.existsSync(path.join(PENDING_DIR, name))).toBe(false);
      expect(fs.existsSync(path.join(PROCESSED_DIR, name))).toBe(true);
    });

    it('processes all operations in a multi-operation file before moving it', async () => {
      // TODO: implement — file with two INSERT ops, assert both rows + processed/
    });

    it('leaves processed/ files in place (retained for audit)', async () => {
      // TODO: implement — run two ticks, assert file still in processed/
    });
  });

  // ─── Retry leaves file in pending ───────────────────────────────────────────────

  describe('transient failure', () => {
    it('increments retryCount and leaves the file in pending/ on a failed write', async () => {
      const name = `retry-${randomUUID()}.json`;
      writeQueueFile(PENDING_DIR, name, {
        queueId: randomUUID(),
        createdAt: '2026-06-13T10:30:00Z',
        retryCount: 0,
        lastAttemptAt: null,
        operations: [
          { step: 'INSERT_SALE_TENDER', table: 'SaleTender', operation: 'INSERT',
            data: { SaleTenderId: randomUUID(), SaleId: '00000000-0000-0000-0000-0000000000ff', TenderMethod: 'Cash', Amount: 1.0 } },
        ],
      });

      // FK violation (SaleId does not exist) makes the write fail.
      await processor.processTick();

      expect(fs.existsSync(path.join(PENDING_DIR, name))).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(path.join(PENDING_DIR, name), 'utf8'));
      expect(parsed.retryCount).toBe(1);
      expect(parsed.lastAttemptAt).not.toBeNull();
    });

    it('does not move a failing file to processed/', async () => {
      // TODO: implement
    });
  });

  // ─── Exceed max retries ───────────────────────────────────────────────────────

  describe('exceeding max retries', () => {
    it('moves the file to failed/ when retryCount exceeds QUEUE_MAX_RETRIES', async () => {
      const name = `exhausted-${randomUUID()}.json`;
      writeQueueFile(PENDING_DIR, name, {
        queueId: randomUUID(),
        createdAt: '2026-06-13T10:30:00Z',
        retryCount: MAX_RETRIES - 1, // one more failure tips it over
        lastAttemptAt: '2026-06-13T11:00:00Z',
        operations: [
          { step: 'INSERT_SALE_TENDER', table: 'SaleTender', operation: 'INSERT',
            data: { SaleTenderId: randomUUID(), SaleId: '00000000-0000-0000-0000-0000000000ff', TenderMethod: 'Cash', Amount: 1.0 } },
        ],
      });

      // Force the write to fail.
      const saleModel = require('../../src/models/sale.model');
      if (saleModel.insertSaleTender) {
        jest.spyOn(saleModel, 'insertSaleTender').mockRejectedValue(new Error('still failing'));
      }

      await processor.processTick();

      expect(fs.existsSync(path.join(FAILED_DIR, name))).toBe(true);
      expect(fs.existsSync(path.join(PROCESSED_DIR, name))).toBe(false);
      expect(fs.existsSync(path.join(PENDING_DIR, name))).toBe(false);
    });

    it('does not delete the file when it moves to failed/', async () => {
      // TODO: implement — assert the file content is preserved in failed/
    });
  });

  // ─── Startup behaviour ──────────────────────────────────────────────────────────

  describe('startup', () => {
    it('processes pre-existing pending/ files immediately on startup without waiting for the timer', async () => {
      // TODO: implement — write a file then call processor.start(); assert it processes
    });

    it('handles an empty pending/ directory without error', async () => {
      await expect(processor.processTick()).resolves.not.toThrow();
    });

    it('ignores non-.json files in pending/', async () => {
      // TODO: implement
    });
  });
});
