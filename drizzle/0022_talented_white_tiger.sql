-- Hand-edited: drizzle-kit generated a bare `ALTER TABLE account ADD issuer text NOT NULL`,
-- which SQLite rejects on a populated table ("Cannot add a NOT NULL column with default value
-- NULL"). better-auth's own migration generator refuses the same statement and points at
-- https://better-auth.com/docs/guides/1-7-upgrade-guide#account-identity-is-scoped-by-issuer,
-- which prescribes a table rebuild for SQLite. Same pattern as 0014_sturdy_nomad.sql.
--
-- better-auth 1.7 scopes account identity by (issuer, accountId). Credential accounts use
-- `local:credential` (`createLocalAccountIssuer('credential')` = `local:${providerId}`), so the
-- backfill derives the value from provider_id rather than hardcoding it. That derivation holds
-- for local providers only: OAuth rows carry `createOAuthAccountIssuer` = `local:oauth:${providerId}`
-- or the provider's real OIDC issuer, and `'local:' || provider_id` would mislabel them. No such
-- row can exist here — no social providers are configured, `emailAndPassword.disableSignUp` is
-- true, and neither the passkey nor the api-key plugin writes `account` rows — so
-- `provider_id = 'credential'` is the only shape present.
--
-- The guide also requires accountId to be the linked user's id for credential accounts. The
-- original scripts/add-user.ts (commit 16b31e5) bypassed better-auth with a raw Drizzle insert
-- and wrote accountId as a separate `crypto.randomUUID()`; better-auth 1.7's email sign-in only
-- accepts a credential row when accountId equals the user's id, and answers 401 otherwise. So
-- credential rows are rewritten to user_id here — a no-op for rows that already comply, which is
-- every row written by better-auth itself or by the current add-user.ts. OAuth rows are left
-- alone, since there accountId is the provider's subject.
--
-- The PRAGMA pair below is inert under scripts/migrate.ts (drizzle-orm's bun-sqlite migrator):
-- all pending migrations run inside ONE transaction and SQLite ignores `PRAGMA foreign_keys`
-- inside a transaction — and migrate.ts never enables foreign_keys on its connection anyway. It
-- is kept for parity with 0014_sturdy_nomad.sql and for anyone applying this file by hand
-- outside a transaction. Safe either way: no table references `account`, and the rebuilt table
-- re-declares its own FK.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `account__new` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`issuer` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `account__new` (`id`, `account_id`, `provider_id`, `issuer`, `user_id`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `password`, `created_at`, `updated_at`)
SELECT `id`, CASE WHEN `provider_id` = 'credential' THEN `user_id` ELSE `account_id` END, `provider_id`, 'local:' || `provider_id`, `user_id`, `access_token`, `refresh_token`, `id_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `password`, `created_at`, `updated_at`
FROM `account`;--> statement-breakpoint
DROP TABLE `account`;--> statement-breakpoint
ALTER TABLE `account__new` RENAME TO `account`;--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `account_issuer_accountId_idx` ON `account` (`issuer`,`account_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
