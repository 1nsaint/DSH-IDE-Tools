#!/bin/sh
# Seed $DSH_HOME from the baked IDE Tools profile on first boot (empty volume).
# Capture 0.1.5+ launch ?token= when DSH_WEB_TOKEN_FILE is set (same as ProDesk).
set -eu

SEED="${DSH_IDE_SEED:-/opt/dsh-ide-tools/seed-home}"
HOME_DIR="${DSH_HOME:-/home/node/.dsh}"
MARKER="${HOME_DIR}/.dsh-ide-tools-seeded"
TOKEN_FILE="${DSH_WEB_TOKEN_FILE:-}"

seed_home() {
	if [ ! -d "$SEED/plugins" ] || [ ! -d "$SEED/profiles" ]; then
		echo "dsh-ide-tools: seed missing at $SEED — image build incomplete" >&2
		return 1
	fi
	mkdir -p "$HOME_DIR"
	echo "dsh-ide-tools: seeding $HOME_DIR from image (first boot)…"
	rsync -a --delete "$SEED/plugins/" "$HOME_DIR/plugins/"
	mkdir -p "$HOME_DIR/profiles"
	rsync -a "$SEED/profiles/" "$HOME_DIR/profiles/"
	if [ -f "$SEED/settings.yaml" ] && [ ! -f "$HOME_DIR/settings.yaml" ]; then
		cp -a "$SEED/settings.yaml" "$HOME_DIR/settings.yaml"
	fi
	if command -v pnpm >/dev/null 2>&1 && [ -f "$HOME_DIR/profiles/web/package.json" ]; then
		echo "dsh-ide-tools: linking profile plugins (pnpm install)…"
		( cd "$HOME_DIR/profiles/web" && pnpm install --no-frozen-lockfile ) || {
			echo "dsh-ide-tools: pnpm install failed — check logs" >&2
			return 1
		}
	fi
	cp -a "$SEED/.dsh-ide-tools-seeded" "$MARKER" 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ >"$MARKER"
	echo "dsh-ide-tools: seed complete"
}

if [ ! -f "$MARKER" ] || [ ! -d "$HOME_DIR/plugins/dsh-terminal" ]; then
	seed_home
fi

run_dsh() {
	exec node --expose-internals \
		/usr/local/lib/node_modules/@deepseek-ai/dsh/lib/bin.js \
		"$@"
}

if [ -z "$TOKEN_FILE" ]; then
	run_dsh "$@"
fi

mkdir -p "$(dirname "$TOKEN_FILE")"

FIFO="$(mktemp -u /tmp/dsh-out.XXXXXX)"
mkfifo "$FIFO"
cleanup() {
	rm -f "$FIFO"
}
trap cleanup EXIT

node --expose-internals \
	/usr/local/lib/node_modules/@deepseek-ai/dsh/lib/bin.js \
	"$@" >"$FIFO" 2>&1 &
PID=$!

forward() {
	kill -s "$1" "$PID" 2>/dev/null || true
}
trap 'forward TERM' TERM
trap 'forward INT' INT

while IFS= read -r line || [ -n "$line" ]; do
	printf '%s\n' "$line"
	case "$line" in
	*token=*)
		tok=$(printf '%s\n' "$line" | sed -n 's/.*[?&]token=\([A-Za-z0-9_-]*\).*/\1/p' | head -1)
		if [ -n "$tok" ]; then
			printf '%s' "$tok" >"${TOKEN_FILE}.tmp"
			mv "${TOKEN_FILE}.tmp" "$TOKEN_FILE"
		fi
		;;
	esac
done <"$FIFO"

set +e
wait "$PID"
status=$?
set -e
exit "$status"
