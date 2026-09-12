# Test suite

Run `bun run test` for the Bun server/domain suite and the Vitest Vue suite.
Tests must assert a user-visible outcome or a persisted state change. An HTTP
status or nonempty component HTML alone does not prove the operation worked.

Bun runs files in four isolated worker processes. Keep tests within a file
serial: `--concurrent` shares and resets the same database and is unsupported.
`bun run test:stability` checks randomized Bun order, a negative UTC offset, and
shuffled Vitest order with reproducible seeds.
The regular Vue suite also fails on leaked timers, promises, and handles.

## Coverage

`bun run coverage` runs both suites and preserves **two separate reports**:

- `coverage/bun/lcov.info`: Bun's coverage of files loaded by its tests, including
  server routes, domain functions, parsers, and pure TypeScript helpers. This is
  loaded-file coverage; a high percentage does not prove every source file has
  a test.
- `coverage/vue/index.html` and `coverage/vue/lcov.info`: all application Vue
  components and browser composables, including files with no tests. Generated
  shadcn components and the two composables tested by Bun are excluded.

These percentages have different denominators and are not combined into an
overall repository percentage. Run `bun run coverage:unit` or
`bun run coverage:vue` for an individual suite. Prioritize untested user actions
and failure paths over increasing a percentage with render-only assertions.

## Useful regression checks

- Freeze time for calendar boundaries and restore it after each test. Check
  calendar-date formatting in both UTC and `TZ=America/Los_Angeles`.
- Use `bun test --parallel=4 --randomize --seed=42` and
  `bunx vitest run --sequence.shuffle --sequence.seed=42` to expose order coupling.
- Test database mutations through the real in-memory SQLite harness. For
  multi-step writes, assert persisted data and rollback on a later failure.
- Use Vue's `nextTick`, `flushPromises`, and fake timers to wait for the specific
  reactive or timed behavior. Avoid sleeps and clean up timers, wrappers, spies,
  and global overrides after each test.
- A component double should honor controlled values, disabled state, and the
  events the real component emits. Keep critical form interactions covered by
  tests that submit inputs and inspect emitted events or API calls.
