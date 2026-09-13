#!/usr/bin/env bash
# Install DSH IDE Tools into a stock DeepSeek Harness $DSH_HOME.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="${DSH_PROFILE:-web}"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
# Path used in profile package.json link: deps (inside-container default).
LINK_PREFIX="${DSH_LINK_PREFIX:-/home/node/.dsh}"
DRY_RUN=0
SKIP_AUTOMATION=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Install plugin sources and wire the web profile for DeepSeek Harness.

Options:
  --dsh-home PATH       Harness data dir (default: \$HOME/.dsh or \$DSH_HOME)
  --profile NAME        Profile name (default: web)
  --link-prefix PATH    Prefix for package.json link: deps (default: /home/node/.dsh)
  --native-links        Set link prefix to the resolved --dsh-home path (native dsh on host)
  --skip-automation     Skip pnpm install in dsh-automation / dsh-cron
  --dry-run             Print actions without changing files
  -h, --help            Show this help

Examples:
  # Docker compose layout (deploy/data mounted at /home/node/.dsh):
  DSH_HOME=$ROOT/deploy/data $0

  # Native Harness on the host:
  $0 --native-links --dsh-home "\$HOME/.dsh"
EOF
}

log() { printf '==> %s\n' "$*"; }
run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run]'; printf ' %q' "$@"; printf '\n'
  else
    "$@"
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dsh-home) DSH_HOME="$2"; shift 2 ;;
    --profile) PROFILE="$2"; shift 2 ;;
    --link-prefix) LINK_PREFIX="$2"; shift 2 ;;
    --native-links) LINK_PREFIX="$(cd "$DSH_HOME" 2>/dev/null && pwd || echo "$DSH_HOME")"; shift ;;
    --skip-automation) SKIP_AUTOMATION=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

DSH_HOME="$(cd "$DSH_HOME" 2>/dev/null && pwd || echo "$DSH_HOME")"
PLUGINS_DIR="$DSH_HOME/plugins"
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"
PATCH_SRC="$ROOT/examples/cordis.patch.full.yml"
PKG_SRC="$ROOT/examples/profile.package.json.full"

if [ ! -d "$ROOT/plugins" ]; then
  echo "Missing plugins/ under $ROOT" >&2
  exit 1
fi
if [ ! -f "$PATCH_SRC" ] || [ ! -f "$PKG_SRC" ]; then
  echo "Missing examples/cordis.patch.full.yml or profile.package.json.full" >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required (install Node.js + pnpm, or run inside the Harness container)." >&2
  exit 1
fi

log "DSH_HOME=$DSH_HOME"
log "Profile=$PROFILE link prefix=$LINK_PREFIX"

mkdir -p "$PLUGINS_DIR" "$PROFILE_DIR"
if [ "$DRY_RUN" -eq 1 ]; then
  log "[dry-run] mkdir -p $PLUGINS_DIR $PROFILE_DIR"
fi

log "Copying plugins (excluding node_modules)…"
if command -v rsync >/dev/null 2>&1; then
  run rsync -a \
    --exclude 'node_modules/' \
    --exclude 'dist/' \
    --exclude '.upstream-git/' \
    "$ROOT/plugins/" "$PLUGINS_DIR/"
else
  run cp -a "$ROOT/plugins/." "$PLUGINS_DIR/"
fi

backup_if_exists() {
  local f="$1"
  if [ -f "$f" ] && [ "$DRY_RUN" -eq 0 ]; then
    cp -a "$f" "$f.bak.$(date +%Y%m%d%H%M%S)"
  fi
}

log "Installing cordis.patch.yml…"
backup_if_exists "$PROFILE_DIR/cordis.patch.yml"
if [ "$DRY_RUN" -eq 1 ]; then
  log "[dry-run] cp $PATCH_SRC $PROFILE_DIR/cordis.patch.yml"
else
  cp "$PATCH_SRC" "$PROFILE_DIR/cordis.patch.yml"
fi

log "Installing profile package.json…"
backup_if_exists "$PROFILE_DIR/package.json"
if [ "$DRY_RUN" -eq 1 ]; then
  log "[dry-run] sed … > $PROFILE_DIR/package.json"
else
  sed "s|__DSH_LINK_PREFIX__|$LINK_PREFIX|g" "$PKG_SRC" > "$PROFILE_DIR/package.json"
fi

install_plugin_deps() {
  local dir="$1"
  local mode="$2"
  [ -f "$dir/package.json" ] || return 0
  log "Dependencies in $(basename "$dir") ($mode)…"
  case "$mode" in
    npm) run sh -c "cd '$dir' && npm install --omit=dev" ;;
    pnpm) run sh -c "cd '$dir' && pnpm install --frozen-lockfile" ;;
  esac
}

install_plugin_deps "$PLUGINS_DIR/dsh-database" npm
install_plugin_deps "$PLUGINS_DIR/dsh-files" npm
install_plugin_deps "$PLUGINS_DIR/dsh-web-search-router" npm

if [ "$SKIP_AUTOMATION" -eq 0 ]; then
  install_plugin_deps "$PLUGINS_DIR/dsh-automation" pnpm
  install_plugin_deps "$PLUGINS_DIR/dsh-cron" pnpm
else
  log "Skipping dsh-automation / dsh-cron (--skip-automation)"
fi

log "pnpm install in profile…"
run sh -c "cd '$PROFILE_DIR' && pnpm install --no-frozen-lockfile"

cat <<EOF

Done. IDE Tools are installed under:
  $PLUGINS_DIR
  $PROFILE_DIR/cordis.patch.yml
  $PROFILE_DIR/package.json

Next steps:
  1. Restart DeepSeek Harness (recreate the container if you use Docker).
  2. Hard-refresh the browser (Ctrl+Shift+R).
  3. Open Settings → Models and configure your LLM endpoint / API key.

Docker (from deploy/):
  cd $ROOT/deploy
  docker compose -f docker-compose.example.yml up -d --build

Security: default compose mounts /var/run/docker.sock so Containers/Database tabs work.
Keep the agent preset workspace-write so shell/Docker actions prompt for approval.
Remove the socket mount from compose if you do not want host Docker access.

See docs/FAQ.md for Cordis, pnpm, volumes, and NPM (external reverse proxy).

EOF
