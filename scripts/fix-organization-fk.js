#!/usr/bin/env node
/**
 * Fix for organizations table FK constraint referencing missing plans table.
 * 
 * On fresh installs, the multitenancy migration creates organizations with
 * plan_id REFERENCES plans(id), but the plans table was dropped by migrations.
 * This causes first user registration to fail with:
 *   SqliteError: no such table: main.plans
 * 
 * Usage: node scripts/fix-organization-fk.js
 */

const path = require('path');
const SERVER_DIR = path.resolve(__dirname, '..', 'server');
const Database = require(require.resolve('better-sqlite3', { paths: [SERVER_DIR] }));
const config = require(path.join(SERVER_DIR, 'config'));

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF'); // Must disable to drop/recreate with FK refs

console.log('[fix-org-fk] Checking organizations table...');

const tableInfo = db.prepare("PRAGMA table_info(organizations)").all();
const planIdCol = tableInfo.find(c => c.name === 'plan_id');

if (!planIdCol) {
  console.log('[fix-org-fk] organizations table does not exist, nothing to fix');
  process.exit(0);
}

// Check if there's a foreign key constraint on plan_id
const fkList = db.prepare("PRAGMA foreign_key_list(organizations)").all();
const hasPlanFk = fkList.some(fk => fk.from === 'plan_id' && fk.table === 'plans');

if (!hasPlanFk) {
  console.log('[fix-org-fk] organizations.plan_id has no FK constraint to plans, nothing to fix');
  process.exit(0);
}

console.log('[fix-org-fk] Found bad FK constraint on plan_id -> plans(id)');
console.log('[fix-org-fk] Recreating organizations table without FK constraint...');

// SQLite doesn't support ALTER TABLE DROP CONSTRAINT, so we rebuild
db.exec(`
  BEGIN TRANSACTION;

  -- Save existing data
  CREATE TABLE _org_backup AS SELECT * FROM organizations;

  -- Drop dependent tables first
  DROP TABLE IF EXISTS workspace_invites;
  DROP TABLE IF EXISTS workspace_members;
  DROP TABLE IF EXISTS workspaces;
  DROP TABLE IF EXISTS organization_members;
  DROP TABLE IF EXISTS organizations;

  -- Recreate organizations without the bad FK
  CREATE TABLE organizations (
    id                      TEXT PRIMARY KEY,
    name                    TEXT NOT NULL,
    slug                    TEXT UNIQUE,
    owner_user_id           TEXT NOT NULL REFERENCES users(id),
    plan_id                 TEXT DEFAULT 'free',
    stripe_customer_id      TEXT,
    stripe_subscription_id  TEXT,
    subscription_status     TEXT DEFAULT 'active',
    subscription_ends       INTEGER,
    grace_period_ends       INTEGER,
    locked_at               INTEGER,
    default_brand_name      TEXT,
    default_logo_url        TEXT,
    default_primary_color   TEXT,
    created_at              INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at              INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  -- Restore data
  INSERT INTO organizations SELECT * FROM _org_backup;
  DROP TABLE _org_backup;

  -- Recreate dependent tables (from migrate-multitenancy.js)
  CREATE TABLE organization_members (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'org_admin',
    invited_by      TEXT REFERENCES users(id),
    joined_at       INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    UNIQUE(organization_id, user_id)
  );

  CREATE TABLE workspaces (
    id                    TEXT PRIMARY KEY,
    organization_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                  TEXT NOT NULL,
    slug                  TEXT,
    created_by            TEXT REFERENCES users(id),
    billing_type          TEXT DEFAULT 'client_billable',
    billing_notes         TEXT,
    billing_contact_email TEXT,
    billing_contract_ref  TEXT,
    created_at            INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at            INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    UNIQUE(organization_id, slug)
  );

  CREATE TABLE workspace_members (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'workspace_viewer',
    invited_by      TEXT REFERENCES users(id),
    joined_at       INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    UNIQUE(workspace_id, user_id)
  );

  CREATE TABLE workspace_invites (
    id              TEXT PRIMARY KEY,
    workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'workspace_viewer',
    invited_by      TEXT NOT NULL REFERENCES users(id),
    expires_at      INTEGER NOT NULL,
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  COMMIT;
`);

console.log('[fix-org-fk] Done! organizations table recreated without plans FK constraint.');
console.log('[fix-org-fk] Restart the server and try registering again.');
