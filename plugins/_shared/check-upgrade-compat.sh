#!/usr/bin/env bash
# Fail CI / pre-upgrade if plugins still use fragile Cordis RPC or (optionally)
# known-stale CSS-module hashes. See UPGRADE.md for the 0.1.5 postmortem.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0

echo "== host RPC: ban connection.rpc.handle (use _shared/register-rpc-channel.js) =="
if rg -n --glob '**/lib/index.js' 'connection\.rpc\.handle' "$ROOT" | rg -v 'register-rpc-channel|^\s*//' ; then
	echo "FAIL: use registerRpcChannel from _shared/register-rpc-channel.js" >&2
	fail=1
else
	echo "ok"
fi

echo "== host RPC: plugins that call registerRpcChannel must inject webServer =="
ws_ok=1
while IFS= read -r f; do
	[[ -z "$f" ]] && continue
	if ! rg -q 'webServer' "$f"; then
		echo "FAIL: $f uses registerRpcChannel but never mentions webServer" >&2
		fail=1
		ws_ok=0
	fi
done < <(rg -l --glob '**/lib/index.js' 'registerRpcChannel' "$ROOT" || true)
[[ "$ws_ok" -eq 1 ]] && echo "ok"

echo "== client: no querySelector(null) left from broken rewrites =="
if rg -n --glob '**/lib/client.js' 'querySelector\(null\)|closest\(null\)|matches\(null\)' "$ROOT"; then
	echo "FAIL: broken selector rewrite residue" >&2
	fail=1
else
	echo "ok"
fi

echo "== client: no doubled escape join(\"\\\\n\") (breaks script inject) =="
if rg -n --glob '**/lib/client.js' 'join\("\\\\n"\)|join\('"'"'\\\\n'"'"'\)' "$ROOT"; then
	echo "FAIL: join(\"\\\\n\") should be join(\"\\n\")" >&2
	fail=1
else
	echo "ok"
fi

echo "== client CSS: prefer [class*=\"_local\"] over hardcoded hashes =="
hashes='bhn1Oq_|qDHVXG_|YDXeBa_|hHd-Xa_|wSkVaW_|uV2eYG_'
mapfile -t hash_files < <(
	rg -l --glob '**/lib/client.js' -e "$hashes" "$ROOT" \
		| while read -r f; do
				real=$(rg -n -e "$hashes" "$f" \
					| rg -v 'STOCK_PREFIX_FALLBACK|falls back for first paint|e\.g\. "wSkVaW_|:\s*"wSkVaW_"|:\s*"bhn1Oq_"|:\s*"qDHVXG_"|:\s*"YDXeBa_"|:\s*"hHd-Xa_"|:\s*"uV2eYG_"| \|\| "wSkVaW_"|/\*\*|^\s*\*|createStockClass|defaultPrefix' \
					|| true)
				if [[ -n "$real" ]]; then echo "$f"; fi
			done || true
)
count=${#hash_files[@]}
echo "client.js files still containing known hash prefixes: $count"
if [[ "$count" -gt 0 ]]; then
	printf '  - %s\n' "${hash_files[@]}" | head -20
	echo "(soft warning: className= for stock chrome needs runtime createStockClass — see client-dom.snippet.js)"
	echo "Codemod: node plugins/_shared/rewrite-client-css-modules.js"
fi
if [[ "${STRICT_CSS_HASH:-0}" == "1" && "$count" != "0" ]]; then
	rg -n --glob '**/lib/client.js' -e "$hashes" "$ROOT" | head -50 >&2
	echo "FAIL: set STRICT_CSS_HASH=0 to allow, or rewrite with rewriteClientSource / discoverPrefix" >&2
	fail=1
fi

echo "== client: warn on always-visible switch chrome (should be hover-reveal) =="
# Soft: .dsh-sf-wsZone should collapse at rest (width:0), not stay at 22px
if rg -n --glob '**/dsh-sidebar-files/lib/client.js' '\.dsh-sf-wsZone\{[^}]*width:22px' "$ROOT" | head -5; then
	echo "(soft warning: wsZone always visible at rest — prefer width:0 + row:hover reveal; see UPGRADE.md)"
fi

echo "== docs: UPGRADE.md present =="
if [[ -f "$ROOT/_shared/UPGRADE.md" ]]; then
	echo "ok"
else
	echo "FAIL: missing _shared/UPGRADE.md" >&2
	fail=1
fi

if [[ "$fail" -ne 0 ]]; then
	exit 1
fi
echo "compat check passed"
