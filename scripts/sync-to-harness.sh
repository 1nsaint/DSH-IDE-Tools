#!/usr/bin/env bash
# Sync plugin sources from this repo into the ProDesk Harness bind mount.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${HARNESS_PLUGINS_DIR:-$ROOT/../deepseek-harness/data/home/plugins}"
PROFILE_NM="${HARNESS_PROFILE_DIR:-$ROOT/../deepseek-harness/data/home/profiles/web/node_modules}"

rsync -a --delete \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude '.upstream-git/' \
  "$ROOT/plugins/" "$TARGET/"
echo "Synced plugins -> $TARGET"

# Profile package.json links must stay relative (../../../plugins/...), not container absolutes.
if [ -d "$PROFILE_NM" ]; then
  for link in "$PROFILE_NM"/dsh-*; do
    [ -L "$link" ] || continue
    base="$(basename "$link")"
    ln -sfn "../../../plugins/$base" "$link"
  done
  echo "Refreshed profile symlinks in $PROFILE_NM"
fi

cat <<'EOF'

Next (when host-side plugin code changed):
  cd ~/Containers/deepseek-harness
  docker compose up -d --force-recreate deepseek-harness dsh-https

Plugins with npm/pnpm dependencies (database, automation, cron, web-search-router, …)
need node_modules installed under their folder on the host after a fresh clone — see docs/INSTALL.md.

EOF
