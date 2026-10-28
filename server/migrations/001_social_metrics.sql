-- Additive, idempotent schema for social OAuth, sessions, connections, and metric snapshots.
-- Migration history is maintained separately in cp_schema_migrations by db.js.
CREATE TABLE IF NOT EXISTS cp_oauth_states (
  state_hash CHAR(64) NOT NULL PRIMARY KEY,
  nonce_hash CHAR(64) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  owner_open_id VARCHAR(255) NULL,
  origin VARCHAR(1024) NOT NULL,
  redirect_uri VARCHAR(2048) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX cp_oauth_expiry_idx (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cp_sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  open_id VARCHAR(255) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX cp_sessions_expiry_idx (expires_at),
  INDEX cp_sessions_open_id_idx (open_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cp_connections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  owner_open_id VARCHAR(255) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NULL,
  handle VARCHAR(255) NULL,
  access_token_cipher TEXT NOT NULL,
  refresh_token_cipher TEXT NULL,
  scope TEXT NULL,
  expires_at DATETIME(3) NULL,
  refresh_expires_at DATETIME(3) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'connected',
  last_synced_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY cp_connection_identity_uq (owner_open_id, provider, provider_user_id),
  INDEX cp_connections_owner_idx (owner_open_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cp_metric_snapshots (
  account_id BIGINT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payload JSON NOT NULL,
  fetched_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (account_id, start_date, end_date),
  CONSTRAINT cp_snapshot_connection_fk FOREIGN KEY (account_id)
    REFERENCES cp_connections(id) ON DELETE CASCADE
) ENGINE=InnoDB;
