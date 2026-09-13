#!/usr/bin/env bash
# Gate a production build before it ships.
#
#   scripts/verify-build.sh kiosk [dist]
#   scripts/verify-build.sh staff [dist]
#
# Both targets: fail if a service-role key, or code naming one, is in the bundle.
#
# Kiosk additionally: fail if the Supabase client, any JWT, or the configured
# database host appears at all. The tablet talks only to /api/kiosk/*. The host
# check reads SUPABASE_URL / VITE_SUPABASE_URL when set, so it keeps working after
# the move to a self-hosted server, where "supabase.co" would no longer appear.
set -euo pipefail

TARGET=${1:-}
DIST=${2:-dist}
case "$TARGET" in
  kiosk|staff) ;;
  *) echo "Usage: $0 <kiosk|staff> [dist]" >&2; exit 2 ;;
esac
[ -d "$DIST" ] || { echo "FAIL: $DIST does not exist. Build the $TARGET target first." >&2; exit 1; }

fail=0

check_absent() {
  local label=$1 pattern=$2 found
  found=$(grep -rlE "$pattern" "$DIST" 2>/dev/null || true)
  if [ -n "$found" ]; then
    echo "FAIL: $label found in the $TARGET bundle:" >&2
    echo "$found" | sed 's/^/    /' >&2
    fail=1
  else
    echo "  ok: no $label"
  fi
}

echo "== credential scan ($TARGET) =="
check_absent "service role key reference" 'SERVICE_ROLE_KEY'

tokens=$(grep -rohE 'eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+' "$DIST" 2>/dev/null | sort -u || true)
token_count=0
service_count=0
if [ -n "$tokens" ]; then
  read -r token_count service_count < <(printf '%s\n' "$tokens" | node -e '
    const lines = require("fs").readFileSync(0, "utf8").split("\n").filter(Boolean);
    let service = 0;
    for (const t of lines) {
      try {
        const claims = JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString());
        if (claims.role === "service_role") service++;
      } catch {}
    }
    console.log(lines.length, service);
  ')
fi

if [ "$service_count" -gt 0 ]; then
  echo "FAIL: $service_count service_role JWT(s) in the $TARGET bundle. Rotate that key now." >&2
  fail=1
else
  echo "  ok: no service_role JWT"
fi

if [ "$TARGET" = kiosk ]; then
  if [ "$token_count" -gt 0 ]; then
    echo "FAIL: $token_count JWT-shaped string(s) in the kiosk bundle. The tablet must hold no key." >&2
    fail=1
  else
    echo "  ok: no JWT at all"
  fi

  check_absent "Supabase client" 'rest/v1|auth/v1|storage/v1'
  check_absent "supabase.co host" 'supabase\.co'

  for var in SUPABASE_URL VITE_SUPABASE_URL; do
    value=${!var:-}
    [ -n "$value" ] || continue
    host=$(printf '%s' "$value" | sed -E 's#^[a-z]+://##; s#/.*$##')
    escaped=$(printf '%s' "$host" | sed 's/[.[\*^$()+?{|]/\\&/g')
    check_absent "configured database host ($host)" "$escaped"
  done

  echo "== bundle budget =="
  BUDGET_BYTES=$((400 * 1024))
  TARGET_BYTES=$((350 * 1024))
  total=0
  while IFS= read -r f; do
    size=$(gzip -c "$f" | wc -c | tr -d ' ')
    total=$((total + size))
    printf "  %-46s %6s KB gzipped\n" "$(basename "$f")" "$((size / 1024))"
  done < <(find "$DIST" -name '*.js' -type f)
  printf "  %-46s %6s KB gzipped\n" "TOTAL JS" "$((total / 1024))"

  if [ "$total" -gt "$BUDGET_BYTES" ]; then
    echo "FAIL: kiosk JS is $((total / 1024)) KB gzipped, over the $((BUDGET_BYTES / 1024)) KB budget." >&2
    fail=1
  elif [ "$total" -gt "$TARGET_BYTES" ]; then
    echo "WARN: kiosk JS is $((total / 1024)) KB gzipped, over the $((TARGET_BYTES / 1024)) KB target."
  else
    echo "  ok: within the $((TARGET_BYTES / 1024)) KB target"
  fi
fi

exit $fail
