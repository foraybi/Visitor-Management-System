#!/usr/bin/env bash
# Gate for the kiosk build. Fails if the tablet bundle is too large or if it
# contains anything that looks like a database credential.
#
# The tablet talks only to /api/kiosk/*. A Supabase host or a JWT-shaped string
# in dist/ means a credential leaked into the client, which is a ship blocker.
set -euo pipefail

DIST=${1:-dist}
BUDGET_BYTES=$((400 * 1024))   # hard fail above 400 KB gzipped
TARGET_BYTES=$((350 * 1024))   # warn above 350 KB gzipped

if [ ! -d "$DIST" ]; then
  echo "FAIL: $DIST does not exist. Run the kiosk build first." >&2
  exit 1
fi

fail=0

echo "== credential scan =="
scan() {
  local label=$1 pattern=$2
  local hits
  hits=$(grep -rlE "$pattern" "$DIST" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    echo "FAIL: $label found in the kiosk bundle:" >&2
    echo "$hits" | sed 's/^/    /' >&2
    fail=1
  else
    echo "  ok: no $label"
  fi
}

scan "Supabase host"        'supabase\.co'
scan "service role key"     'SERVICE_ROLE|service_role'
scan "JWT-shaped string"    'eyJ[A-Za-z0-9_-]{20,}'

echo "== bundle budget =="
total=0
while IFS= read -r f; do
  size=$(gzip -c "$f" | wc -c | tr -d ' ')
  total=$((total + size))
  printf "  %-46s %6s KB gzipped\n" "$(basename "$f")" "$((size / 1024))"
done < <(find "$DIST" -name '*.js' -type f)

echo "  ----"
printf "  %-46s %6s KB gzipped\n" "TOTAL JS" "$((total / 1024))"

if [ "$total" -gt "$BUDGET_BYTES" ]; then
  echo "FAIL: kiosk JS is $((total / 1024)) KB gzipped, over the $((BUDGET_BYTES / 1024)) KB budget." >&2
  fail=1
elif [ "$total" -gt "$TARGET_BYTES" ]; then
  echo "WARN: kiosk JS is $((total / 1024)) KB gzipped, over the $((TARGET_BYTES / 1024)) KB target."
else
  echo "  ok: within the $((TARGET_BYTES / 1024)) KB target"
fi

exit $fail
