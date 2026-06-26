-- ═══════════════════════════════════════
-- ORACLE — Initial Database Schema
-- Projects · Time Entries · Invoices · Memories · Knowledge Docs · Proposals · Prompts
-- ═══════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Projects ─────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  client_name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Paused', 'Complete', 'On Hold', 'Prospect')),
  value TEXT NOT NULL DEFAULT '',
  deadline TEXT,
  city TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  requirements JSONB NOT NULL DEFAULT '[]',
  contact_name TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]',
  total_hours REAL DEFAULT 0,
  invoice_total REAL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- ─── Time Entries ─────────────────────
CREATE TABLE IF NOT EXISTS time_entries (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  client_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  hours REAL NOT NULL DEFAULT 0,
  rate REAL NOT NULL DEFAULT 0,
  date BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  billable BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_time_entries_client ON time_entries(client_id);

-- ─── Invoices ─────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  client_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]',
  subtotal REAL NOT NULL DEFAULT 0,
  gst REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Paid', 'Overdue')),
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  due_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  notes TEXT
);

CREATE INDEX idx_invoices_client ON invoices(client_id);

-- ─── Memories ─────────────────────────
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  client_id TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('preference', 'fact', 'feedback', 'decision', 'contact')),
  importance INTEGER NOT NULL DEFAULT 2 CHECK (importance IN (1, 2, 3)),
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

CREATE INDEX idx_memories_client ON memories(client_id);

-- ─── Knowledge Documents ──────────────
CREATE TABLE IF NOT EXISTS knowledge_docs (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'upload',
  tags JSONB NOT NULL DEFAULT '[]',
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- ─── Proposals ────────────────────────
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  brief TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '',
  output TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- ─── Custom Prompts ───────────────────
CREATE TABLE IF NOT EXISTS custom_prompts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'Medium',
  time_estimate TEXT NOT NULL DEFAULT '10 min',
  tools JSONB NOT NULL DEFAULT '[]',
  description TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  use_count INTEGER DEFAULT 0,
  user_rating INTEGER DEFAULT 0,
  last_used BIGINT
);

-- ─── Prompt Favourites ────────────────
CREATE TABLE IF NOT EXISTS prompt_favourites (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  prompt_id TEXT NOT NULL UNIQUE,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);
