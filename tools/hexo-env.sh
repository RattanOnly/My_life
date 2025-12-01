#!/usr/bin/env bash
# Wrapper for Hexo commands that auto-loads `.env` so Algolia keys
# (and other secrets) are always present.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a

  if [[ -n "${ALGOLIA_SEARCH_KEY:-}" && -z "${ALGOLIA_API_KEY:-}" ]]; then
    export ALGOLIA_API_KEY="$ALGOLIA_SEARCH_KEY"
  fi
  if [[ -n "${HEXO_ALGOLIA_INDEXING_KEY:-}" && -z "${ALGOLIA_ADMIN_API_KEY:-}" ]]; then
    export ALGOLIA_ADMIN_API_KEY="$HEXO_ALGOLIA_INDEXING_KEY"
  fi
else
  printf '[hexo-env] Warning: %s not found; running without extra env vars.\n' "$ENV_FILE" >&2
fi

cd "$ROOT_DIR"
npx hexo "$@"
