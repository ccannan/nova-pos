// tests/helpers/constants.js
//
// Fixed GUIDs seeded by the migration scripts. Tests must use these constants
// rather than auto-generated IDs so that seed data is stable across runs and
// environments.

// ItemStatus IDs — match the values seeded in
// database/migrations/002-seed-item-status.sql
const STATUS = {
  ACTIVE:       '10000001-0000-0000-0000-000000000001',
  SOLD:         '10000001-0000-0000-0000-000000000002',
  ON_HOLD:      '10000001-0000-0000-0000-000000000003',
  LAYBY:        '10000001-0000-0000-0000-000000000004',
  CONSIGNMENT:  '10000001-0000-0000-0000-000000000005',
  RETURNED:     '10000001-0000-0000-0000-000000000006',
  WRITTEN_OFF:  '10000001-0000-0000-0000-000000000007',
};

// Default store seeded in migrations
const DEFAULT_STORE_ID = '20000001-0000-0000-0000-000000000001';

module.exports = { STATUS, DEFAULT_STORE_ID };
