# Changelog

## v0.11.1

[compare changes](https://github.com/florivdg/dimetime/compare/v0.11.0...v0.11.1)

### 🚀 Enhancements

- **presets:** Add half-yearly (halbjährlich) recurrence option ([b2880d7](https://github.com/florivdg/dimetime/commit/b2880d7))
- **dashboard:** Fall back to nearest upcoming plan when none active ([0ca9b9d](https://github.com/florivdg/dimetime/commit/0ca9b9d))

### 🩹 Fixes

- **deps:** Pin kysely to 0.28.x for better-auth compatibility ([9ef84c5](https://github.com/florivdg/dimetime/commit/9ef84c5))

### ❤️ Contributors

- Florian van der Galiën <hallo@flori.dev>

## v0.11.0

[compare changes](https://github.com/florivdg/dimetime/compare/v0.10.0...v0.11.0)

### 🩹 Fixes

- **auth:** Add verified field to twoFactor schema ([129567e](https://github.com/florivdg/dimetime/commit/129567e))
- **bank-transactions:** Alias createdAt in UNION ALL so sortBy works ([ef98dbe](https://github.com/florivdg/dimetime/commit/ef98dbe))
- **transactions:** Import missing Plus icon in TransactionCreateDialog ([bb3164c](https://github.com/florivdg/dimetime/commit/bb3164c))

### 💅 Refactors

- **api:** Extract shared response, schema, validation, and handler helpers and adopt them across routes ([82dea0b](https://github.com/florivdg/dimetime/commit/82dea0b), [b70bd15](https://github.com/florivdg/dimetime/commit/b70bd15), [ede4e7c](https://github.com/florivdg/dimetime/commit/ede4e7c))
- **db:** Break schema cycles and extract timestamps, buildSetValues, and shared column helpers ([b0c1960](https://github.com/florivdg/dimetime/commit/b0c1960), [33e3064](https://github.com/florivdg/dimetime/commit/33e3064))
- **composables:** Extract shared dialog/sort/url-state and auth/2fa composables ([9020331](https://github.com/florivdg/dimetime/commit/9020331), [8b3002f](https://github.com/florivdg/dimetime/commit/8b3002f))
- **bank-import:** Split easybank-xlsx parser and import service into smaller helpers ([ec4d63a](https://github.com/florivdg/dimetime/commit/ec4d63a), [4977c9d](https://github.com/florivdg/dimetime/commit/4977c9d))
- **presets:** Extract preset-matching module and simplify condition builders ([70759c8](https://github.com/florivdg/dimetime/commit/70759c8), [9866f80](https://github.com/florivdg/dimetime/commit/9866f80))
- Eliminate fallow duplication (77 → 3 clone groups) and reduce complexity hotspots ([77a0199](https://github.com/florivdg/dimetime/commit/77a0199), [2c14829](https://github.com/florivdg/dimetime/commit/2c14829))

### 📖 Documentation

- **redirect:** Explain SSR same-origin shortcut ([c5c04db](https://github.com/florivdg/dimetime/commit/c5c04db))

### 🏡 Chore

- **lint:** Add fallow audit and Claude Code commit-time gate ([6cd0a42](https://github.com/florivdg/dimetime/commit/6cd0a42))
- **fallow:** Clean up dead code and configure test entry patterns ([2b88023](https://github.com/florivdg/dimetime/commit/2b88023))
- **.gitignore:** Update to include CLAUDE.local.md ([a4252a9](https://github.com/florivdg/dimetime/commit/a4252a9))
- **fallow:** Suppress accepted code-duplication clones ([9fc22fd](https://github.com/florivdg/dimetime/commit/9fc22fd))
- **fallow:** Calibrate audit thresholds and ignore framework deps ([e872e75](https://github.com/florivdg/dimetime/commit/e872e75))
- **test:** Add Vitest stack for Vue component and composable tests ([948fab5](https://github.com/florivdg/dimetime/commit/948fab5))
- **test:** Extract shared test-db fixture, switch Vitest to .vitest.ts ([f9c8719](https://github.com/florivdg/dimetime/commit/f9c8719))
- **ui:** Restore shadcn-vue components to upstream formatting + prettier-ignore ([71b8953](https://github.com/florivdg/dimetime/commit/71b8953))
- **package:** Add vite version override in package.json ([cc93918](https://github.com/florivdg/dimetime/commit/cc93918))

### ❤️ Contributors

- Florian van der Galiën <hallo@flori.dev>

## v0.10.0

[compare changes](https://github.com/florivdg/dimetime/compare/v0.9.3...v0.10.0)

### 🚀 Enhancements

- **budgets:** Add progress bar and monthly pacing tooltip to budget badge across plans and transactions ([bcb6e30](https://github.com/florivdg/dimetime/commit/bcb6e30), [098fa21](https://github.com/florivdg/dimetime/commit/098fa21))
- **bank-transactions:** Persist bulk selection across actions ([ea20e1c](https://github.com/florivdg/dimetime/commit/ea20e1c))

### 🩹 Fixes

- **db:** Prevent SQLite lock errors in dev by caching connection across HMR ([2a39592](https://github.com/florivdg/dimetime/commit/2a39592))

### 🏡 Chore

- **tsconfig:** Add bun types to tsconfig.json ([69d7a0a](https://github.com/florivdg/dimetime/commit/69d7a0a))

### ❤️ Contributors

- Florian van der Galiën <hallo@flori.dev>

## v0.9.3

[compare changes](https://github.com/florivdg/dimetime/compare/v0.9.2...v0.9.3)

### 🚀 Enhancements

- **bank-transactions:** Show purpose and note in transaction tooltip ([234e300](https://github.com/florivdg/dimetime/commit/234e300))
- **bank-import:** Upgrade pending transactions to booked on re-import ([ec7365b](https://github.com/florivdg/dimetime/commit/ec7365b))
- **bank-transactions:** Add delete functionality for individual transactions ([d4d1a9c](https://github.com/florivdg/dimetime/commit/d4d1a9c))
- **bank-transactions:** Show all plans in filter and add archive action ([cdce772](https://github.com/florivdg/dimetime/commit/cdce772))
- **bank-transactions:** Add notes support for split transactions ([bc85df4](https://github.com/florivdg/dimetime/commit/bc85df4))

### 🩹 Fixes

- **docker:** Set NODE_ENV and conditional origin check for local dev ([33c24b7](https://github.com/florivdg/dimetime/commit/33c24b7))

### ❤️ Contributors

- Florian van der Galiën <hallo@flori.dev>

## v0.9.2

[compare changes](https://github.com/florivdg/dimetime/compare/v0.9.1...v0.9.2)

### 🩹 Fixes

- **db:** Add exclusive locking mode to prevent -shm file issues in Docker ([3697d1b](https://github.com/florivdg/dimetime/commit/3697d1b))

### ❤️ Contributors

- Florian van der Galiën <hallo@flori.dev>

## v0.9.1

[compare changes](https://github.com/florivdg/dimetime/compare/v0.9.0...v0.9.1)

### 🩹 Fixes

- **db:** Add WAL pragma to migration script to prevent SQLITE_IOERR_SHMSIZE in Docker ([a0bc5e1](https://github.com/florivdg/dimetime/commit/a0bc5e1))

### ❤️ Contributors

- Florian van der Galiën <hallo@flori.dev>

## v0.9.0

[compare changes](https://github.com/florivdg/dimetime/compare/v0.8.0...v0.9.0)

### 🚀 Enhancements

- **bank-transactions:** Add split transactions with per-split plan/budget assignment and archiving ([#12](https://github.com/florivdg/dimetime/pull/12))

### 🩹 Fixes

- **api:** Wrap bulk-assign-plan and bulk-assign-budget in DB transactions ([0940bc3](https://github.com/florivdg/dimetime/commit/0940bc3))
- **bank-transactions:** Prevent table from overflowing viewport in sidebar layout ([f119cca](https://github.com/florivdg/dimetime/commit/f119cca))

### 💅 Refactors

- **api:** Use jsonResponse/jsonError helpers in bank transaction endpoints ([72f6cfb](https://github.com/florivdg/dimetime/commit/72f6cfb))

### ❤️ Contributors

- Florian van der Galiën <hallo@flori.dev>

## v0.8.0

[compare changes](https://github.com/florivdg/dimetime/compare/v0.7.1...v0.8.0)

### 🚀 Enhancements

- **bank-transactions:** Add bulk plan assignment for selected transactions ([9a8445f](https://github.com/florivdg/dimetime/commit/9a8445f))
- **budgets:** Add budget tracking with utilization badges for plans and transactions ([#11](https://github.com/florivdg/dimetime/pull/11))

### 💅 Refactors

- Remove Kassensturz (bank reconciliation) feature ([#10](https://github.com/florivdg/dimetime/pull/10))
- **sidebar:** Move Transaktionen under Pläne as sub-item ([5bfe3d0](https://github.com/florivdg/dimetime/commit/5bfe3d0))

### ❤️ Contributors

- Florian van der Galiën <hallo@flori.dev>

## v0.7.1

[compare changes](https://github.com/florivdg/dimetime/compare/v0.7.0...v0.7.1)

### 🚀 Enhancements

- **bank-transactions:** Add notes, inline editing, and bulk archive functionality ([#9](https://github.com/florivdg/dimetime/pull/9))

### 🏡 Chore

- **.gitignore:** Add .playwright-cli to ignore list ([b04606d](https://github.com/florivdg/dimetime/commit/b04606d))
- **dependencies:** Update better-auth and passkey to version 1.4.20 ([eaabc81](https://github.com/florivdg/dimetime/commit/eaabc81))

### ❤️ Contributors

- Florian van der Galiën <hallo@flori.dev>

## v0.7.0

[compare changes](https://github.com/florivdg/dimetime/compare/v0.6.0...v0.7.0)

### 🚀 Enhancements

- **ui:** Add Progress and Tabs components with templates and props handling ([a87380f](https://github.com/florivdg/dimetime/commit/a87380f))
- **kassensturz:** Implement dismissal and manual entry features for bank transactions ([ad2245a](https://github.com/florivdg/dimetime/commit/ad2245a))
- **kassensturz:** Implement auto-reconciliation feature with learning capabilities ([0a0d795](https://github.com/florivdg/dimetime/commit/0a0d795))

### 🏡 Chore

- Remove unused components and API endpoints ([858ee72](https://github.com/florivdg/dimetime/commit/858ee72))

### ❤️ Contributors

- Florian van der Galiën <hallo@flori.dev>

## v0.6.0

[compare changes](https://github.com/florivdg/dimetime/compare/v0.5.1...v0.6.0)

### 🚀 Enhancements

- **bank-import:** Add bank import feature with CSV parsing, interactive stepper, and multi-source support
- **bank-import:** Add plan filtering and assignment for imported transactions
- **reconcile:** Make bank reconcile conflict-safe with deterministic 409
- **command:** Implement command palette with context management
- **popover:** Add Popover component and related subcomponents

### 🩹 Fixes

- **sidebar:** Remove unused import and simplify active section logic

### 💅 Refactors

- **bank-import:** Remove old import wizard and inline source creation

### 📖 Documentation

- **claude:** Clarify data access policy in authentication flow
- **readme:** Update project description and enhance feature list
- **deployment:** Update user creation instructions and clarify 2FA requirement

### ✅ Tests

- **reconciliation:** Update test descriptions to English for clarity

### ❤️ Contributors

- Florian van der Galiën <hallo@flori.dev>

## v0.5.1

[compare changes](https://github.com/florivdg/dimetime/compare/v0.5.0...v0.5.1)

### 🚀 Enhancements

- **config:** Enhance security settings with allowed domains and hosts ([3d06eea](https://github.com/florivdg/dimetime/commit/3d06eea))

### ❤️ Contributors

- Florian van der Galiën <hallo@flori.dev>

## v0.5.0

[compare changes](https://github.com/florivdg/dimetime/compare/v0.4.0...v0.5.0)

### 🚀 Enhancements

- **presets:** Add dayOfMonth field for custom due dates ([5eaf37b](https://github.com/florivdg/dimetime/commit/5eaf37b))

### 🎨 Styles

- **presets:** Use compact 2-column grid layout in create/edit dialogs ([cc3efb6](https://github.com/florivdg/dimetime/commit/cc3efb6))

### ❤️ Contributors

- Florian van der Galiën <hallo@flori.dev>

## v0.4.0

[compare changes](https://github.com/florivdg/dimetime/compare/v0.3.0...v0.4.0)

### 🚀 Enhancements

- **presets:** Add functionality to save transactions as presets and manage preset creation ([4c3dc30](https://github.com/florivdg/dimetime/commit/4c3dc30))

### ❤️ Contributors

- Florian van der Galiën <hallo@flori.dev>

## v0.3.0

[compare changes](https://github.com/florivdg/dimetime/compare/v0.2.0...v0.3.0)

### 🚀 Enhancements

- **settings:** Sync user settings to localStorage after authentication ([#4](https://github.com/florivdg/dimetime/issues/4))
- **filters:** Enhance transaction filters with status options and UI adjustments ([2a4af0b](https://github.com/florivdg/dimetime/commit/2a4af0b))

### 📖 Documentation

- **deployment:** Update backup instructions and add backup script ([cfaf3a2](https://github.com/florivdg/dimetime/commit/cfaf3a2))

### ❤️ Contributors

- Florian van der Galiën <hallo@flori.dev>

## v0.2.0

[compare changes](https://github.com/florivdg/dimetime/compare/v0.1.0...v0.2.0)

### 🚀 Enhancements

- **transactions:** Add transaction move functionality with dialog ([631e361](https://github.com/florivdg/dimetime/commit/631e361))
- **presets:** Implement transaction presets management with CRUD operations and UI components ([0858632](https://github.com/florivdg/dimetime/commit/0858632))
- **plans:** Add functionality to fill transactions from presets and copy transactions between plans ([a2d1f87](https://github.com/florivdg/dimetime/commit/a2d1f87))

### 🩹 Fixes

- **settings:** Resolve hydration mismatch in theme settings ([aa7c188](https://github.com/florivdg/dimetime/commit/aa7c188))
- **plans:** Optimize API reload logic for filter changes ([69cb376](https://github.com/florivdg/dimetime/commit/69cb376))
- **plans:** Refine initial mount logic to conditionally skip API call based on URL filters ([121bb8c](https://github.com/florivdg/dimetime/commit/121bb8c))
- **transactions:** Change planId type from string to uuid in updateTransactionSchema ([e6b1796](https://github.com/florivdg/dimetime/commit/e6b1796))

### 💅 Refactors

- **presets:** Simplify date handling for expired presets ([87fe3ef](https://github.com/florivdg/dimetime/commit/87fe3ef))
- **presets:** Update schema to use z.uuid() for planId and presetIds ([9e827f4](https://github.com/florivdg/dimetime/commit/9e827f4))
- **presets:** Simplify sorting logic and improve table layout ([9f967f7](https://github.com/florivdg/dimetime/commit/9f967f7))
- **transactions:** Optimize bulk copy logic and reduce transaction count ([9f948fe](https://github.com/florivdg/dimetime/commit/9f948fe))

### ❤️ Contributors

- Florian van der Galiën <hallo@flori.dev>
