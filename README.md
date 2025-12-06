# DimeTime

> **Work in Progress** - This project is under active development.

A German-language personal financial planner web application for managing budgets, tracking transactions, and organizing expenses by category.

## Overview

DimeTime helps you plan and track your personal finances with:

- **Monthly budget plans** - Create financial plans for specific periods
- **Transaction tracking** - Record income and expenses with due dates
- **Category management** - Organize transactions with color-coded categories
- **Dashboard analytics** - Visualize spending patterns and balance overview

## Features

- Dashboard with balance overview, monthly spending charts, and category breakdown
- Plan management with archiving and search functionality
- Transaction filtering by category, type, date range, and amount
- Passkey (WebAuthn) authentication for passwordless login
- Email/password authentication
- Data import wizard for bulk transaction import
- Responsive design for desktop and mobile

## Tech Stack

- **Astro 5** - SSR framework with Node adapter
- **Vue 3** - Interactive components with Composition API
- **SQLite** - Database with Drizzle ORM
- **Better Auth** - Authentication with passkey support
- **Tailwind CSS 4** - Styling with CSS-first syntax
- **Reka UI** - Headless component primitives (shadcn-vue style)

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
| `bun run lint --type-aware` | Run linter                      |
| `bun run astro check`       | TypeScript and Astro validation |

## Project Structure

```
src/
├── pages/          # Astro file-based routing
├── components/     # Vue components
│   ├── ui/         # shadcn-vue style components
│   ├── plans/      # Plan management
│   ├── transactions/
│   ├── categories/
│   └── dashboard/
├── db/schema/      # Drizzle schema definitions
├── lib/            # Utilities and auth config
└── middleware.ts   # Route protection
scripts/            # CLI tools (migrations, user management)
```
