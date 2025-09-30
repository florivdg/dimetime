# Repository Guidelines

## Project Structure & Module Organization

Source lives in `src/`. Astro routes sit in `src/pages/` (`index.astro` currently) while shared layouts belong in `src/layouts/`. Vue single-file components and boot code reside in `src/vue/` (`App.vue`, `_app.ts`). Global styles load from `src/styles/global.css`. Static assets should be committed to `public/`. Keep configuration at the root (`astro.config.mjs`, `tsconfig.json`, `auto-imports.d.ts`) to avoid duplication across packages.

## Build, Test, and Development Commands

Use `bun run dev` (or `bun dev`) for a hot-reloading Astro dev server. `bun run build` performs the production build and surfaces integration issues between Astro, Vue, and Tailwind. `bun run preview` serves the built output locally for final validation. `bun run astro -- check` runs Astro's diagnostics when you need a quick sanity check on content collections and configuration.

## Coding Style & Naming Conventions

The project relies on Prettier with `prettier-plugin-astro` and `prettier-plugin-tailwindcss`; run `bunx prettier --check .` before pushing or enable format-on-save. Use two-space indentation, PascalCase for Vue components, and kebab-case route filenames. Favor colocated component-specific styles scoped via `<style>` blocks; keep cross-cutting CSS in `src/styles/global.css`.

## Testing Guidelines

No automated test harness is configured yet. When adding tests, prefer Vitest with the Vue plugin and place specs beside the code (`Component.spec.ts`). Until then, treat `bun run build` as the regression gate and manually exercise critical flows in `bun run preview`. Document any manual test steps in your PR description.

## Commit & Pull Request Guidelines

Follow the Conventional Commit style already in history (`feat:`, `chore:`, etc.) with present-tense, lower-case summaries. Reference issue IDs when applicable. Pull requests should describe the change, list manual or automated checks performed, and include screenshots or screen recordings for UI updates. Request at least one review when altering shared layouts or global styling to keep Astro/Vue integration healthy.
