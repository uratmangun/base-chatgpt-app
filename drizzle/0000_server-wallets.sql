CREATE TABLE IF NOT EXISTS "server_wallets" (
  "id" serial PRIMARY KEY,
  "base_account_address" varchar(64) NOT NULL,
  "sub_account_address" varchar(64),
  "server_wallet_address" varchar(64) NOT NULL,
  "name" text,
  "chain_id" integer,
  "policy_ids" jsonb,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "server_wallets_server_wallet_address_idx"
  ON "server_wallets" ("server_wallet_address");

CREATE INDEX IF NOT EXISTS "server_wallets_base_idx"
  ON "server_wallets" ("base_account_address");

CREATE INDEX IF NOT EXISTS "server_wallets_sub_idx"
  ON "server_wallets" ("sub_account_address");
