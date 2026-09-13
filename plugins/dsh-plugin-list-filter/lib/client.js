// dsh-plugin-list-filter — filter + descriptions for Settings → Plugins → Plugin list.
window.__ModuleLoader__.load({
	id: "dsh-plugin-list-filter",
	factory: () => {
		const PLUGIN = "dsh-plugin-list-filter";
		const RPC_CHANNEL = "/plugin-list-filter";
		const MODE_KEY = "dsh-plugin-list-filter.mode";

		const css = [
			".dplf_row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:0 2px}",
			".dplf_label{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;white-space:nowrap}",
			".dplf_group{display:inline-flex;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}",
			".dplf_btn{font:inherit;cursor:pointer;border:0;background:transparent;color:var(--dsw-alias-label-secondary);min-height:28px;padding:0 12px;font-size:12px;line-height:28px}",
			".dplf_btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}",
			".dplf_btn[data-active=true]{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);font-weight:600}",
			".dplf_btn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}",
			".dplf_detailsDesc{color:var(--dsw-alias-label-secondary);margin:0 0 10px;font-size:12px;line-height:18px}",
		].join("");

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let tag = document.getElementById("dsh-plugin-list-filter-css");
			if (!tag) {
				tag = document.createElement("style");
				tag.id = "dsh-plugin-list-filter-css";
				document.head.appendChild(tag);
			}
			tag.textContent = css;
		}

		async function callRpc(connection, endpoint) {
			const result = await connection.rpc.call(RPC_CHANNEL, endpoint, {});
			if (!result.ok) throw new Error(result.error?.message || `${endpoint} failed`);
			return result.value;
		}

		function loadMode() {
			try {
				const v = localStorage.getItem(MODE_KEY);
				if (v === "preinstalled" || v === "custom" || v === "all") return v;
			} catch { /* ignore */ }
			return "all";
		}

		function saveMode(mode) {
			try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
		}

		/**
		 * @param {string} moduleName
		 */
		function moduleShortName(moduleName) {
			return String(moduleName || "")
				.replace(/^@deepseek-ai\//, "")
				.replace(/^cordis:/, "")
				.replace(/^cordis-plugin-/, "")
				.replace(/^dsh-(?:host-|client-)?/, "");
		}

		/**
		 * @param {string} entryId
		 * @param {string} moduleName
		 * @param {Record<string, string>} descriptions
		 */
		function resolveDescription(entryId, moduleName, descriptions) {
			/** @type {string[]} */
			const keys = [];
			const id = String(entryId || "").trim();
			if (id) {
				keys.push(id);
				if (id.includes(":")) keys.push(id.slice(id.lastIndexOf(":") + 1));
			}
			if (moduleName) {
				keys.push(moduleName, moduleShortName(moduleName), moduleName.split("/").pop());
			}
			for (const key of keys) {
				const hit = descriptions[String(key || "").trim()];
				if (hit) return hit;
			}
			return "";
		}

		function cleanupButtonDescription(card) {
			card.removeAttribute("data-dplf-desc");
			const btn = card.querySelector(".qSYn7G_cardContent");
			if (!(btn instanceof HTMLElement)) return;
			btn.querySelector(".dplf_desc")?.remove();
			const wrap = btn.querySelector(".dplf_main");
			const title = btn.querySelector(".qSYn7G_cardTitle");
			if (wrap instanceof HTMLElement && title instanceof HTMLElement && title.parentElement === wrap) {
				wrap.replaceWith(title);
			}
		}

		/**
		 * @param {string} entryId
		 * @param {Set<string>} customIds
		 */
		function isCustomEntry(entryId, customIds) {
			const id = String(entryId || "").trim();
			if (!id) return false;
			if (customIds.has(id)) return true;
			if (id.startsWith("dsh-")) return true;
			for (const customId of customIds) {
				if (id.endsWith(`/${customId}`) || id.includes(customId)) return true;
			}
			return false;
		}

		const inject = ["connection"];

		function apply(ctx) {
			ensureStyles();
			try {
				document.documentElement.setAttribute("data-dsh-plugin-list-filter", "0.1.2");
			} catch { /* ignore */ }

			ctx.inject(["connection"], (scope) => {
				const connection = scope.connection || scope.get?.("connection");
				if (!connection?.rpc?.call) {
					console.warn(`[${PLUGIN}] connection unavailable`);
					return;
				}

				/** @type {Set<string>} */
				let customIds = new Set();
				/** @type {Record<string, string>} */
				let descriptions = {};
				let mode = loadMode();
				let catalog = null;
				let toolbar = null;

				const fetchCatalogMeta = async () => {
					try {
						const res = await callRpc(connection, "catalogMeta");
						customIds = new Set(res?.ids || []);
						descriptions = res?.descriptions || {};
					} catch (err) {
						console.warn(`[${PLUGIN}] catalogMeta failed`, err);
					}
				};

				const applyDescriptions = () => {
					if (!(catalog instanceof Element)) return;
					for (const card of catalog.querySelectorAll("li.qSYn7G_card")) {
						cleanupButtonDescription(card);

						const title = card.querySelector(".qSYn7G_cardTitle");
						const details = card.querySelector(".qSYn7G_cardDetails");
						if (!(title instanceof HTMLElement)) continue;

						const entryId = card.getAttribute("data-plugin-entry") || "";
						const moduleName = title.getAttribute("title") || "";
						const desc = resolveDescription(entryId, moduleName, descriptions);
						const existing = details instanceof HTMLElement
							? details.querySelector(".dplf_detailsDesc")
							: null;

						if (!(details instanceof HTMLElement)) {
							existing?.remove();
							continue;
						}

						if (!desc) {
							existing?.remove();
							continue;
						}

						let descEl = existing;
						if (!(descEl instanceof HTMLElement)) {
							descEl = document.createElement("p");
							descEl.className = "dplf_detailsDesc";
							details.prepend(descEl);
						}
						if (descEl.textContent !== desc) descEl.textContent = desc;
					}
				};

				const applyFilter = () => {
					if (!(catalog instanceof Element)) return;
					const cards = catalog.querySelectorAll("li.qSYn7G_card");
					let visible = 0;
					for (const card of cards) {
						const entryId = card.getAttribute("data-plugin-entry") || "";
						const custom = isCustomEntry(entryId, customIds);
						const show = mode === "all"
							|| (mode === "custom" && custom)
							|| (mode === "preinstalled" && !custom);
						card.style.display = show ? "" : "none";
						if (show) visible += 1;
					}
					const countEl = catalog.querySelector("[data-plugin-count]");
					if (countEl) countEl.textContent = String(visible);
				};

				const syncToolbar = () => {
					if (!(toolbar instanceof Element)) return;
					for (const btn of toolbar.querySelectorAll(".dplf_btn")) {
						btn.setAttribute("data-active", btn.dataset.mode === mode ? "true" : "false");
					}
				};

				const ensureToolbar = (root) => {
					if (!(root instanceof Element)) return;
					if (root.querySelector(".dplf_row")) {
						toolbar = root.querySelector(".dplf_row");
						syncToolbar();
						return;
					}
					const heading = root.querySelector(".qSYn7G_catalogHeading");
					const row = document.createElement("div");
					row.className = "dplf_row";
					row.innerHTML = [
						'<span class="dplf_label">Show</span>',
						'<div class="dplf_group" role="group" aria-label="Plugin origin filter">',
						'<button type="button" class="dplf_btn" data-mode="all">All</button>',
						'<button type="button" class="dplf_btn" data-mode="preinstalled">Preinstalled</button>',
						'<button type="button" class="dplf_btn" data-mode="custom">Custom</button>',
						"</div>",
					].join("");
					row.addEventListener("click", (event) => {
						const btn = event.target instanceof Element
							? event.target.closest(".dplf_btn")
							: null;
						if (!(btn instanceof HTMLButtonElement)) return;
						const next = btn.dataset.mode;
						if (next !== "all" && next !== "preinstalled" && next !== "custom") return;
						mode = next;
						saveMode(mode);
						syncToolbar();
						applyFilter();
					});
					if (heading) heading.before(row);
					else root.prepend(row);
					toolbar = row;
					syncToolbar();
				};

				const wireCatalog = (root) => {
					if (!(root instanceof Element)) return;
					catalog = root;
					ensureToolbar(root);
					applyDescriptions();
					applyFilter();
				};

				let debounce = 0;
				const schedule = () => {
					clearTimeout(debounce);
					debounce = window.setTimeout(() => {
						const section = document.querySelector(".pbvGtq_section .qSYn7G_catalog");
						if (section instanceof Element) wireCatalog(section);
					}, 30);
				};

				scope.effect(() => {
					void fetchCatalogMeta().then(schedule);

					const observer = new MutationObserver(schedule);
					observer.observe(document.body, { childList: true, subtree: true });
					schedule();

					return () => {
						clearTimeout(debounce);
						observer.disconnect();
					};
				}, `${PLUGIN}: plugin list filter`);
			});
		}

		return { apply, inject };
	},
});
