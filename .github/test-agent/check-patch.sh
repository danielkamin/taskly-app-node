#!/usr/bin/env bash
# Applies the agent's patch to the git index and fails unless it touches only test files.
# This is the hard guarantee behind the agent's rules and permission allowlist.
# Usage: check-patch.sh <patch-file>
set -euo pipefail
patch="$1"

if grep -q '^GIT binary patch' "$patch"; then
  echo "::error::Agent patch contains binary changes."
  exit 1
fi
git apply --index --whitespace=nowarn "$patch"

allowed='^(backend/tests/.+\.test\.ts|backend/tests/fixture\.ts|frontend/src/.+\.test\.tsx?|frontend/src/test/todoFixture\.ts)$'
bad=0
# Quoted (unusual) paths never match the pattern, so they fail closed.
while IFS=$'\t' read -r status path; do
  if [[ ! "$path" =~ $allowed ]]; then
    echo "::error::Agent changed a non-test file: $path ($status)"
    bad=1
  fi
done < <(git diff --cached --name-status --no-renames)
if git diff --cached --summary | grep -qE 'mode (120000|100755)'; then
  echo "::error::Agent patch adds symlinks or executable files."
  bad=1
fi
exit "$bad"
