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

# Database - DO NOT RUN THESE! THIS IS DONE BY THE USER ONLY.
bun run db:generate  # Generate Drizzle migrations from schema
bun run db:migrate   # Run database migrations

# Code Quality
bun run lint --type-aware  # Run OxLint
bun run astro check        # Astro project check
```

### Authentication Flow

- Middleware (`src/middleware.ts`) protects all routes except `/login` and `/api/auth/*`
- **No per-user data scoping** — all authenticated users share access to all data. Do not introduce user-based authorization checks or data filtering.

### Component Patterns

- Always prefer installing pre-built components from shadcn-vue than creating new base compoenents yourself. Use the shadcn-vue MCP server to look up existing components and see how they are used and configured.

## Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json)

## Formatting & checks

- After applying changes, always run the linter `bun run lint --type-aware` and `bun run astro check`
- If Vue.js components were changed, ensure that the TypeScript types are correct by running `bunx vue-tsc --noEmit`
- After final changes, run the `bunx prettier --write` on changed files to ensure consistent formatting
- always use german umlaute for user facing UI texts
