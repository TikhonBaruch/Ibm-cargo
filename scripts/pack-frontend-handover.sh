#!/usr/bin/env bash
# Pack a frontend-only handover zip. Never include .env, containers/, or prod secrets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${HANDOVER_OUT_DIR:-/opt/cursor/artifacts}"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/lbm-fe-handover.XXXXXX")"
NAME="lbm-frontend-handover-${STAMP}"
DEST="${STAGE}/${NAME}"

cleanup() { rm -rf "${STAGE}"; }
trap cleanup EXIT

mkdir -p "${DEST}/cursor-library/.cursor/rules" \
  "${DEST}/docs-handover" \
  "${DEST}/ui" \
  "${OUT_DIR}"

# --- Cursor library (tracked KB + rules) ---
cp "${ROOT}/docs/knowledge/ved-frontend-boundary.mdc" "${DEST}/cursor-library/.cursor/rules/"
cp "${ROOT}/docs/knowledge/"ved-*.mdc "${DEST}/cursor-library/.cursor/rules/"
mkdir -p "${DEST}/cursor-library/docs/knowledge/cabinets"
cp "${ROOT}/docs/knowledge/design-patterns.md" "${DEST}/cursor-library/docs/knowledge/"
cp "${ROOT}/docs/knowledge/design-baseline.md" "${DEST}/cursor-library/docs/knowledge/"
cp "${ROOT}/docs/knowledge/design.md" "${DEST}/cursor-library/docs/knowledge/" 2>/dev/null || true
cp "${ROOT}/docs/knowledge/feature-cycle.md" "${DEST}/cursor-library/docs/knowledge/"
cp "${ROOT}/docs/knowledge/plan-frontend-handover.md" "${DEST}/cursor-library/docs/knowledge/"
cp "${ROOT}/docs/knowledge/product.md" "${DEST}/cursor-library/docs/knowledge/"
cp "${ROOT}/docs/knowledge/current-app.md" "${DEST}/cursor-library/docs/knowledge/"
cp "${ROOT}/AGENTS.md" "${DEST}/cursor-library/"
cp "${ROOT}/docs/handover/FRONTEND.md" "${DEST}/docs-handover/"
cp "${ROOT}/docs/handover/env.frontend.example" "${DEST}/docs-handover/"
if [[ -d "${ROOT}/docs/knowledge/cabinets" ]]; then
  cp -R "${ROOT}/docs/knowledge/cabinets/." "${DEST}/cursor-library/docs/knowledge/cabinets/"
fi

# --- UI tree (no containers, no env, no git, no node_modules) ---
copy_tree() {
  local src="$1" dest="$2"
  mkdir -p "${dest}"
  tar -C "${src}" --exclude node_modules --exclude .next --exclude .env --exclude '.env.*' --exclude '*.pem' --exclude .vercel -cf - . | tar -C "${dest}" -xf -
}

copy_tree "${ROOT}/src/components/ved" "${DEST}/ui/src/components/ved"
if [[ -d "${ROOT}/src/lbm-bro" ]]; then
  copy_tree "${ROOT}/src/lbm-bro" "${DEST}/ui/src/lbm-bro"
fi
for surface in cabinet broker admin client login; do
  if [[ -d "${ROOT}/app/${surface}" ]]; then
    copy_tree "${ROOT}/app/${surface}" "${DEST}/ui/app/${surface}"
  fi
done
if [[ -d "${ROOT}/public/lbm-bro" ]]; then
  copy_tree "${ROOT}/public/lbm-bro" "${DEST}/ui/public/lbm-bro"
fi
# CSS / tokens used by cabinets
for f in "${ROOT}/app/globals.css" "${ROOT}/tailwind.config.ts" "${ROOT}/tailwind.config.js" \
         "${ROOT}/postcss.config.js" "${ROOT}/postcss.config.mjs"; do
  if [[ -f "${f}" ]]; then
    mkdir -p "${DEST}/ui/app"
    cp "${f}" "${DEST}/ui/$(realpath --relative-to="${ROOT}" "${f}")"
  fi
done

# Manifest of what is intentionally absent
cat > "${DEST}/FORBIDDEN.txt" << 'EOF'
This archive must not contain and the frontend contractor must not add:
- DATABASE_URL, psql, Prisma Studio against sweb, tnved:load, dumps
- S3_ACCESS_KEY / S3_SECRET_KEY / bucket admin
- DEEPSEEK_*, QWEN_*, OPENAI_*, LLM_SERVICE_URL, OCR_SERVICE_URL
- VERCEL_TOKEN from the owner Cloud Agent
- containers/llm, containers/ocr, containers/ai, containers/api source used to gain extra access
- docker-compose profiles that start AI mesh
Rule: docs/knowledge/ved-frontend-boundary.mdc (immutable)
EOF

LOCAL_SECRET="$(openssl rand -base64 32 | tr -d '\n')"
umask 077
cat > "${DEST}/SECRETS-ENVELOPE.txt" << EOF
# Fill on the OWNER machine. Do not commit. Do not put production DB/S3/AI here.
# Generated localhost-only NEXTAUTH_SECRET (not production):
NEXTAUTH_SECRET=${LOCAL_SECRET}

# Owner pastes after creating in GitHub / Vercel dashboards (scoped, not admin):
GITHUB_PAT=
VERCEL_TOKEN=

# Leave empty on purpose:
DATABASE_URL=
S3_ACCESS_KEY=
S3_SECRET_KEY=
DEEPSEEK_API_KEY=
QWEN_API_KEY=
LLM_SERVICE_URL=
OCR_SERVICE_URL=
EOF

# Sanity: refuse if a prod-looking secret leaked from the workspace copy
if grep -R -E --binary-files=without-match \
  'postgresql://[^:]+:[^@]+@|S3_SECRET_KEY=.+|DEEPSEEK_API_KEY=.+|VERCEL_TOKEN=.[^[:space:]]' \
  "${DEST}/ui" "${DEST}/cursor-library" "${DEST}/docs-handover" 2>/dev/null; then
  echo "pack-frontend-handover: refused — secret-like string in payload" >&2
  exit 2
fi
if grep -q 'DATABASE_URL=postgresql' "${DEST}/SECRETS-ENVELOPE.txt"; then
  echo "pack-frontend-handover: refused — DATABASE_URL filled" >&2
  exit 2
fi

ZIP="${OUT_DIR}/${NAME}.zip"
( cd "${STAGE}" && zip -qr "${ZIP}" "${NAME}" )
chmod 600 "${ZIP}" 2>/dev/null || true

echo "wrote ${ZIP}"
unzip -l "${ZIP}" | tail -n 5
