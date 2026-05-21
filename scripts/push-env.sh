#!/bin/bash
# Pushes all variables from .env.local to Vercel via REST API
# Usage: bash scripts/push-env.sh

set -e

ENV_FILE="${1:-.env.local}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found."
  exit 1
fi

# Get Vercel token and project info
VERCEL_TOKEN=$(cat ~/.local/share/com.vercel.cli/auth.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(list(d.get('token','') or d.values())[0] if not isinstance(d,str) else d)" 2>/dev/null || \
               cat ~/.config/vercel/auth.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null || echo "")

if [ -z "$VERCEL_TOKEN" ]; then
  # Try extracting from vercel config
  VERCEL_TOKEN=$(python3 -c "
import json, os, glob
paths = glob.glob(os.path.expanduser('~/.local/share/com.vercel.cli/auth.json')) + \
        glob.glob(os.path.expanduser('~/.config/vercel/auth.json')) + \
        glob.glob(os.path.expanduser('~/Library/Application Support/com.vercel.cli/auth.json'))
for p in paths:
    try:
        d = json.load(open(p))
        t = d.get('token') or next(iter(d.values()))
        if t: print(t); break
    except: pass
" 2>/dev/null || echo "")
fi

if [ -z "$VERCEL_TOKEN" ]; then
  echo "Could not find Vercel token. Falling back to CLI method..."
  USE_CLI=1
fi

# Get project ID from .vercel/project.json
PROJECT_ID=$(python3 -c "import json; d=json.load(open('.vercel/project.json')); print(d['projectId'])" 2>/dev/null || echo "")
ORG_ID=$(python3 -c "import json; d=json.load(open('.vercel/project.json')); print(d['orgId'])" 2>/dev/null || echo "")

echo "Pushing env vars from $ENV_FILE to Vercel..."
echo ""

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue

  key="${line%%=*}"
  value="${line#*=}"

  if [[ -z "$value" ]]; then
    echo "⚠  Skipping $key (empty value)"
    continue
  fi

  echo "→ $key"

  if [ -n "$USE_CLI" ] || [ -z "$PROJECT_ID" ]; then
    # CLI fallback: production + development only (preview skipped)
    printf '%s' "$value" | npx vercel env add "$key" production --force --yes 2>/dev/null || true
    printf '%s' "$value" | npx vercel env add "$key" development --force --yes 2>/dev/null || true
  else
    # REST API: set for all environments at once
    curl -s -X POST "https://api.vercel.com/v10/projects/$PROJECT_ID/env?teamId=$ORG_ID&upsert=true" \
      -H "Authorization: Bearer $VERCEL_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"key\":\"$key\",\"value\":$(echo "$value" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read().rstrip()))'),\"type\":\"plain\",\"target\":[\"production\",\"preview\",\"development\"]}" \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✓' if 'key' in d else '  ✗ ' + d.get('error',{}).get('message','unknown error'))"
  fi

done < "$ENV_FILE"

echo ""
echo "Done! Deploying to production..."
npx vercel deploy --prod --yes 2>&1 | tail -5
