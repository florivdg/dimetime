#!/usr/bin/env bash
# Claude Code PreToolUse-Bash gate: blocks `git commit` / `git push` when
# `fallow audit` returns verdict "fail". Pass-through for any other Bash command.
# Docs: https://docs.fallow.tools/integrations/claude-hooks

set -u

payload="$(cat)"

extract() {
  printf '%s' "$payload" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
print(data.get("tool_input", {}).get("command", ""))
' 2>/dev/null
}

bash_command="$(extract)"

case "$bash_command" in
  *"git commit"*|*"git push"*) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

runner=""
if command -v bunx >/dev/null 2>&1; then
  runner="bunx"
elif command -v npx >/dev/null 2>&1; then
  runner="npx"
else
  echo "fallow-gate: neither bunx nor npx found on PATH; skipping audit" >&2
  exit 0
fi

audit_json="$("$runner" fallow audit --format json --quiet --explain 2>/dev/null)"
status=$?

if [ $status -ne 0 ] && [ -z "$audit_json" ]; then
  echo "fallow-gate: \`$runner fallow audit\` failed to run (exit $status); allowing commit" >&2
  exit 0
fi

verdict="$(printf '%s' "$audit_json" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
print(data.get("verdict", ""))
' 2>/dev/null)"

if [ "$verdict" = "fail" ]; then
  echo "fallow-gate: blocking — \`fallow audit\` verdict = fail" >&2
  printf '%s\n' "$audit_json" >&2
  exit 2
fi

exit 0
