window.__ModuleLoader__.load({
  id: "dsh-web-search-router",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const React = require("react");

    const STYLE_ID = "dsh-web-search-router-style";
    const CSS = [
      ".cyh-search-page{max-width:760px;color:var(--dsw-alias-label-primary);font-size:13px;}",
      ".cyh-search-page h2{margin:0 0 8px;font-size:18px;font-weight:600;}",
      ".cyh-search-intro{margin:0 0 16px;color:var(--dsw-alias-label-tertiary);line-height:1.55;}",
      ".cyh-search-card{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:14px 16px;margin:0 0 10px;background:var(--dsw-alias-bg-layer-1);}",
      ".cyh-search-row{display:flex;align-items:center;gap:10px;min-width:0;}",
      ".cyh-search-name{font-weight:600;flex:1;min-width:0;}",
      ".cyh-search-state{font-size:12px;color:var(--dsw-alias-label-tertiary);}",
      ".cyh-search-state.ok{color:var(--dsw-alias-state-success-primary);}",
      ".cyh-search-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px;}",
      ".cyh-search-updated{color:var(--dsw-alias-label-tertiary);font-size:12px;min-width:0;}",
      ".cyh-search-quota{margin:7px 0 0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.45;}",
      ".cyh-search-field{display:flex;gap:8px;margin-top:12px;}",
      ".cyh-search-input{flex:1;min-width:0;height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);padding:0 10px;font:inherit;}",
      ".cyh-search-input:focus{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-1px;}",
      ".cyh-search-btn{height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);padding:0 12px;font:inherit;cursor:pointer;white-space:nowrap;}",
      ".cyh-search-btn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary);}",
      ".cyh-search-btn:disabled{opacity:.5;cursor:default;}",
      ".cyh-search-note{margin:8px 0 0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.45;}",
      ".cyh-search-error{margin:0 0 12px;color:var(--dsw-alias-state-error-primary);}",
      ".cyh-search-footer{margin-top:16px;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;}"
    ].join("");

    function ensureStyle() {
      if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    // Keyless first (Parallel, DuckDuckGo), then keyed free-tier APIs.
    const SOURCES = [
      { id: "parallel", name: "Parallel", ref: null, note: "Keyless — tried first. No API key required." },
      { id: "duckduckgo", name: "DuckDuckGo", ref: null, note: "Keyless Instant Answer API — free fallback (limited coverage)." },
      { id: "searxng", name: "SearXNG", ref: "SEARXNG_URL", note: "Optional public/self-hosted SearXNG base URL (e.g. https://searx.be). Stored like a credential." },
      { id: "serpapi", name: "SerpApi", ref: "SERPAPI_API_KEY", note: "Google results via SerpApi (free tier)." },
      { id: "brave", name: "Brave Search", ref: "BRAVE_SEARCH_API_KEY", note: "Brave Search API free tier." },
      { id: "tavily", name: "Tavily", ref: "TAVILY_API_KEY", note: "Optional Tavily free-tier key." },
      { id: "serper", name: "Serper", ref: "SERPER_API_KEY", note: "Optional Serper.dev free-tier key." },
      { id: "exa", name: "Exa", ref: "EXA_API_KEY", note: "Optional Exa free-tier key." }
    ];

    function messageOf(error) {
      return error && typeof error.message === "string" ? error.message : String(error);
    }

    /** Unwrap Typert Result `{ ok, value }` or pass through a bare value. */
    function unwrap(response) {
      if (response && typeof response === "object" && "ok" in response) {
        if (!response.ok) {
          const err = response.error;
          throw new Error(err?.message || "credentials request failed");
        }
        return response.value;
      }
      return response;
    }

    function quotaText(source, usage) {
      if (!usage?.configured) return "Paste the same API key you use in n8n, then Save.";
      if (usage.cooldownUntil > Date.now()) return "In cooldown — temporarily skipped.";
      const quota = usage.quota;
      if (!quota || typeof quota.remaining !== "number") return "Quota unknown (will still try when selected).";
      const prefix = quota.source === "estimate" ? "Estimated" : quota.source === "response-header" ? "Header quota" : "Live quota";
      const latency = typeof usage.latencyMs === "number" ? ` · ${usage.latencyMs} ms` : "";
      const warning = usage.usageError ? " · last refresh failed (using cache)" : "";
      return `${prefix}: ${Math.floor(quota.remaining)} / ${Math.floor(quota.limit)} remaining${latency}${warning}`;
    }

    function SearchCard({ source, status, usage, onSave, onRemove, busy }) {
      const [draft, setDraft] = React.useState("");
      const keyless = !source.ref;
      return React.createElement("div", { className: "cyh-search-card" },
        React.createElement("div", { className: "cyh-search-row" },
          React.createElement("div", { className: "cyh-search-name" }, source.name),
          React.createElement("div", { className: `cyh-search-state${(keyless || status?.configured) ? " ok" : ""}` },
            keyless ? "Keyless" : (status?.configured ? "Configured" : "Not set")
          )
        ),
        React.createElement("p", { className: "cyh-search-note" }, source.note),
        React.createElement("p", { className: "cyh-search-quota" }, keyless
          ? (usage?.cooldownUntil > Date.now() ? "In cooldown — temporarily skipped." : "No API key needed.")
          : quotaText(source, usage)),
        keyless ? null : React.createElement("div", { className: "cyh-search-field" },
          React.createElement("input", {
            className: "cyh-search-input",
            type: source.id === "searxng" ? "url" : "password",
            value: draft,
            "aria-label": `${source.name} ${source.id === "searxng" ? "URL" : "API Key"}`,
            placeholder: status?.configured
              ? (source.id === "searxng" ? "Configured — leave blank to keep" : "Configured — leave blank to keep")
              : (source.id === "searxng" ? "https://searx.example" : "Paste API key"),
            autoComplete: "new-password",
            onChange: (event) => setDraft(event.target.value),
          }),
          React.createElement("button", {
            className: "cyh-search-btn",
            type: "button",
            disabled: busy || !draft.trim(),
            onClick: async () => {
              const ok = await onSave(source.ref, draft.trim());
              if (ok) setDraft("");
            }
          }, busy ? "Saving…" : "Save"),
          status?.configured ? React.createElement("button", {
            className: "cyh-search-btn",
            type: "button",
            disabled: busy,
            onClick: () => onRemove(source.ref)
          }, "Clear") : null
        )
      );
    }

    function SearchSettingsPage({ credentials }) {
      const [statuses, setStatuses] = React.useState({});
      const [usageStatuses, setUsageStatuses] = React.useState({});
      const [refreshedAt, setRefreshedAt] = React.useState(null);
      const [busy, setBusy] = React.useState(null);
      const [error, setError] = React.useState(null);

      const load = React.useCallback(async (refreshUsage = false) => {
        const refs = SOURCES.filter((source) => source.ref).map((source) => source.ref);
        try {
          const [described, usageResponse] = await Promise.all([
            credentials.describe(refs).then(unwrap),
            fetch(`/api/web-search-router/status${refreshUsage ? "?refresh=1" : ""}`, { cache: "no-store" })
          ]);
          if (!usageResponse.ok) throw new Error("Could not read quota status");
          const usageData = await usageResponse.json();
          if (!usageData.ok) throw new Error(usageData.error || "Could not read quota status");
          // New remote: Record<ref, CredentialInfo>. Legacy: { credentials: ... }.
          const next = described?.credentials && typeof described.credentials === "object"
            ? described.credentials
            : (described || {});
          setStatuses(next);
          setUsageStatuses(Object.fromEntries((usageData.providers || []).map((provider) => [provider.id, provider])));
          setRefreshedAt(usageData.refreshedAt || Date.now());
        } catch (cause) {
          setError(messageOf(cause));
        }
      }, [credentials]);

      React.useEffect(() => { load(true); }, [load]);

      async function save(ref, value) {
        setBusy(ref);
        setError(null);
        try {
          unwrap(await credentials.set(ref, value));
          await load(true);
          return true;
        } catch (cause) {
          setError(messageOf(cause));
          return false;
        } finally {
          setBusy(null);
        }
      }

      async function remove(ref) {
        setBusy(ref);
        setError(null);
        try {
          unwrap(await credentials.unset(ref));
          await load(false);
        } catch (cause) {
          setError(messageOf(cause));
        } finally {
          setBusy(null);
        }
      }

      return React.createElement("div", { className: "cyh-search-page" },
        React.createElement("h2", null, "Web Search"),
        React.createElement("p", { className: "cyh-search-intro" },
          "Agent web_search tries keyless Parallel and DuckDuckGo first, then your keyed APIs (SerpApi, Brave, Tavily, Serper, Exa). Keys are write-only credentials and are never shown again after save."
        ),
        React.createElement("div", { className: "cyh-search-toolbar" },
          React.createElement("span", { className: "cyh-search-updated" },
            refreshedAt ? `Quota updated ${new Date(refreshedAt).toLocaleTimeString()}` : "Loading quota…"
          ),
          React.createElement("button", {
            className: "cyh-search-btn",
            type: "button",
            disabled: busy !== null,
            onClick: async () => {
              setBusy("__refresh__");
              setError(null);
              try { await load(true); } finally { setBusy(null); }
            }
          }, busy === "__refresh__" ? "Refreshing…" : "Refresh quota")
        ),
        error ? React.createElement("p", { className: "cyh-search-error", role: "alert" }, error) : null,
        SOURCES.map((source) => React.createElement(SearchCard, {
          key: source.id,
          source,
          status: source.ref ? statuses[source.ref] : { configured: true },
          usage: usageStatuses[source.id],
          busy: busy === source.ref,
          onSave: save,
          onRemove: remove
        })),
        React.createElement("p", { className: "cyh-search-footer" },
          "Active provider is multi-search. Duplicate URLs are merged; failed providers enter a cooldown."
        )
      );
    }

    const inject = ["slots", "remote.credentials"];

    function apply(ctx) {
      ensureStyle();
      ctx.effect(() => () => document.getElementById(STYLE_ID)?.remove(), "multi-search settings styles");
      // Must use get() — reading ctx.remote requires inject "remote" and crashes otherwise.
      const credentials = ctx.get("remote.credentials");
      if (!credentials?.describe) {
        console.warn("[dsh-web-search-router] remote.credentials unavailable — Web Search settings not registered");
        return;
      }
      ctx.slots.inject("settings.section", () => ctx.slots.register(
        { name: "settings.section", id: "web-search-router", order: 25, label: () => "Web Search" },
        () => React.createElement(SearchSettingsPage, { credentials })
      ));
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
