# Changelog

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
