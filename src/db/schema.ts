import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const serverWallets = pgTable(
  "server_wallets",
  {
    id: serial("id").primaryKey(),
    baseAccountAddress: varchar("base_account_address", { length: 64 }).notNull(),
    subAccountAddress: varchar("sub_account_address", { length: 64 }),
    serverWalletAddress: varchar("server_wallet_address", { length: 64 })
      .notNull()
      .unique(),
    name: text("name"),
    chainId: integer("chain_id"),
    policyIds: jsonb("policy_ids").$type<string[] | null>(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    baseIdx: index("server_wallets_base_idx").on(table.baseAccountAddress),
    subIdx: index("server_wallets_sub_idx").on(table.subAccountAddress),
  }),
);

export type ServerWallet = typeof serverWallets.$inferSelect;
export type NewServerWallet = typeof serverWallets.$inferInsert;

export const serverWalletsRelations = relations(serverWallets, () => ({}));
