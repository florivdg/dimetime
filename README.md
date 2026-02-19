# DimeTime

> **Work in Progress** - This project is under active development.

A German-language personal financial planner web application for managing budgets, tracking transactions, importing bank statements, and organizing expenses by category. Includes transaction presets with recurrence support and mandatory two-factor authentication.

## Overview

DimeTime helps you plan and track your personal finances with:

- **Monthly budget plans** - Create financial plans for specific periods
- **Transaction tracking** - Record income and expenses with due dates
- **Transaction presets** - Reusable templates with recurrence options, bulk-apply to plans
- **Category management** - Organize transactions with color-coded categories
- **Bank statement import** - Multi-step import wizard supporting ING CSV and Easybank XLSX formats, with deduplication
- **Bank transaction reconciliation** - Link imported bank transactions to planned budget entries
- **Dashboard analytics** - Visualize spending patterns and balance overview

## Features

- Dashboard with balance overview, monthly spending charts, and category breakdown
- Plan management with archiving and search functionality
- Transaction filtering by category, type, date range, and amount
- Cross-plan transaction view for filtering transactions across all plans
- Transaction presets with recurrence and bulk-apply support
- Bank statement import with multi-step wizard and duplicate detection
- Bank transaction reconciliation against planned entries
- Passkey (WebAuthn) authentication for passwordless login
- Email/password authentication
- Mandatory TOTP-based two-factor authentication (2FA)
- Account management with passkey management and password change
- Light/dark theme settings
- Responsive design for desktop and mobile

## Tech Stack

- **Astro 5** - SSR framework with Node adapter
- **Vue 3** - Interactive components with Composition API
- **SQLite** - Database with Drizzle ORM
- **Better Auth** - Authentication with passkey and 2FA support
- **Tailwind CSS 4** - Styling with CSS-first syntax
- **Reka UI** - Headless component primitives (shadcn-vue style)
- **TanStack Table** - Table management
- **Unovis** - Data visualization / charts
- **VeeValidate + Zod** - Form validation
- **VueUse** - Vue composables

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) runtime

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd dimetime

# Install dependencies
bun install

# Copy environment template
cp .env.example .env
```

### Environment Variables

Configure the following in `.env`:

```env
DB_FILE_NAME=sqlite.db
BETTER_AUTH_SECRET=<base64-32-byte-secret>
BETTER_AUTH_URL=http://localhost:4321
PASSKEY_RP_ID=localhost
PASSKEY_ORIGIN=http://localhost:4321
```

Generate the auth secret:

```bash
openssl rand -base64 32
```

### Database Setup

```bash
# Run migrations
bun run db:migrate

# Create a user
bun scripts/add-user.ts <email> <password> [name]
```

### Development

```bash
# Start dev server at localhost:4321
bun --bun run dev
```

## Commands

| Command                     | Description                     |
| :-------------------------- | :------------------------------ |
| `bun --bun run dev`         | Start development server        |
| `bun run build`             | Build for production            |
| `bun --bun run preview`     | Preview production build        |
| `bun run db:migrate`        | Run database migrations         |
| `bun run test`              | Run tests                       |
| `bun run lint --type-aware` | Run linter                      |
| `bun run astro check`       | TypeScript and Astro validation |

## Releasing

Docker images are automatically built and published to GitHub Container Registry when version tags are pushed.

### Release Workflow

1. Merge all changes to `main`
2. Create and push a version tag:
   ```bash
   git checkout main
   git pull origin main
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions builds multi-platform images (amd64, arm64) and publishes to `ghcr.io`

> **Important:** Tags must be created on the `main` branch. Tags on feature or release branches will not trigger a build.

### Pulling the Image

```bash
docker pull ghcr.io/<owner>/dimetime:latest
# or specific version
docker pull ghcr.io/<owner>/dimetime:1.0.0
```

## Project Structure

```
src/
├── pages/                  # Astro file-based routing
│   ├── 2fa/                # Two-factor setup & verification
│   ├── bank-transactions/  # Bank transaction views
│   ├── categories/         # Category management
│   ├── import-sources/     # Import source configuration
│   ├── plans/              # Plan listing & detail
│   ├── presets/            # Preset management
│   ├── transactions/       # Cross-plan transaction view
│   └── api/                # REST API endpoints
├── components/             # Vue components
│   ├── ui/                 # shadcn-vue style components
│   ├── bank-transactions/  # Import wizard & transaction table
│   ├── categories/         # Category CRUD
│   ├── dashboard/          # Dashboard cards & charts
│   ├── import-sources/     # Import source CRUD
│   ├── plans/              # Plan management & transaction filters
│   ├── presets/            # Preset CRUD & bulk-apply
│   ├── settings/           # Theme & user settings
│   └── transactions/       # Transaction CRUD & table
├── composables/            # Vue composables (filters, URL state, etc.)
├── db/schema/              # Drizzle schema definitions
├── lib/                    # Utilities and auth config
│   └── bank-import/        # Bank import service
│       └── parsers/        # ING CSV & Easybank XLSX parsers
└── middleware.ts           # Route protection
scripts/                    # CLI tools (migrations, user management)
```
