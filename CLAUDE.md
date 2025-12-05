# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DimeTime is a German-language personal financial planner web application built with Astro 5, Vue 3, and Better Auth. It uses SQLite with Drizzle ORM and features passkey (WebAuthn) authentication support.

## Commands

```bash
# Development
bun --bun run dev      # Start dev server at localhost:4321
bun run build          # Build for production
bun --bun run preview  # Preview production build

# Database
bun run db:generate  # Generate Drizzle migrations from schema - never run this directly
bun run db:migrate   # Run database migrations - never run this directly

# Code Quality
bun run lint --type-aware  # Run OxLint
bun run astro check        # Astro project check
```

## Architecture

### Tech Stack

- **Astro 5** - SSR framework with Node adapter (standalone mode)
- **Vue 3** - Interactive components with `<script setup>`
- **Better Auth** - Authentication with passkey support
- **Drizzle ORM** - SQLite database with WAL mode
- **Tailwind CSS 4** - CSS-first syntax with `@theme` blocks
- **Reka UI** - Headless component primitives (shadcn-vue style)

### Key Directories

- `src/pages/` - Astro file-based routing (SSR)
- `src/components/ui/` - shadcn-vue style UI components
- `src/db/schema/` - Drizzle schema definitions
- `src/lib/` - Auth configuration and utilities
- `scripts/` - CLI scripts (migrations, user management)
- `drizzle`- Never touch this folder - auto-generated Drizzle files

### Authentication Flow

- Middleware (`src/middleware.ts`) protects all routes except `/login` and `/api/auth/*`
- Better Auth handles sessions via `src/lib/auth.ts` (server) and `src/lib/auth-client.ts` (client)
- Supports email/password + passkeys (WebAuthn)

### Component Patterns

- Always prefer installing pre-built components from shadcn-vue than creating new base compoenents yourself. Use the shadcn-vue MCP server to look up existing components and see how they are used and configured.
- All components use TypeScript with strict typing

## Environment Variables

Required in `.env` (see `.env.example`):

- `DB_FILE_NAME` - SQLite database path
- `BETTER_AUTH_SECRET` - 32-byte base64 secret
- `BETTER_AUTH_URL` - Auth callback URL
- `PASSKEY_RP_ID` - WebAuthn relying party ID
- `PASSKEY_ORIGIN` - WebAuthn origin

## Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json)

## Formatting & checks

- After applying changes, always run the linter and astro check
- After final changes, run the `bunx prettier --write` on changed files to ensure consistent formatting
- always use german umlaute for user facing UI texts
