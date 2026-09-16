// dsh-workspace-delete — replace stock delete-workspace confirm with full cleanup.
window.__ModuleLoader__.load({
	id: "dsh-workspace-delete",
	factory: (require) => {
		const PLUGIN = "dsh-workspace-delete";
		const RPC_CHANNEL = "/workspace-delete";

		const css = [
			".dwd_warn{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;margin:0}",
			".dwd_warnStrong{color:var(--dsw-alias-state-error-primary);font-weight:500}",
			".dwd_meta{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;margin:8px 0 0}",
			".dwd_error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;margin-top:8px}",
		].join("");

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let tag = document.getElementById("dsh-workspace-delete-css");
			if (!tag) {
				tag = document.createElement("style");
				tag.id = "dsh-workspace-delete-css";
				document.head.appendChild(tag);
			}
			tag.textContent = css;
		}

		async function callRpc(connection, endpoint, payload) {
			const result = await connection.rpc.call(RPC_CHANNEL, endpoint, payload ?? {});
			if (!result.ok) throw new Error(result.error?.message || `${endpoint} failed`);
			return result.value;
		}

		function workspaceItems(workspaces) {
			return workspaces?.list?.getSnapshot?.()?.items || [];
		}

		function workspaceIdFromEntity(entity) {
			return entity?.id || entity?.workspaceId || null;
		}

		function resolveWorkspaceId(workspaces, title, pathHint) {
			const items = workspaceItems(workspaces);
			const titleNorm = String(title || "").trim();
			const pathNorm = String(pathHint || "").trim();
			if (pathNorm) {
				const byPath = items.find((w) => String(w.path || "").trim() === pathNorm);
				if (byPath) return workspaceIdFromEntity(byPath);
			}
			if (titleNorm) {
				const byTitle = items.find((w) => String(w.title || w.name || "").trim() === titleNorm);
				if (byTitle) return workspaceIdFromEntity(byTitle);
			}
			return null;
		}

		function parseDialogTarget(dialog) {
			const text = (dialog.textContent || "").replace(/\s+/g, " ").trim();
			const quoted = text.match(/removes?\s+[“"']([^”"']+)[”"']/i)
				|| text.match(/delete\s+[“"']([^”"']+)[”"']/i);
			if (quoted?.[1]) return { title: quoted[1].trim(), path: null };

			const heading = dialog.querySelector("h1,h2,h3,[role='heading']");
			const headingText = (heading?.textContent || "").replace(/\s+/g, " ").trim();
			if (headingText && !/delete workspace/i.test(headingText)) {
				return { title: headingText, path: null };
			}
			return { title: null, path: null };
		}

		function buildWarning(preview) {
			const parts = [];
			if (preview.hasFiles) {
				const fileLabel = preview.fileCount === 1 ? "1 file" : `${preview.fileCount} files`;
				const dirLabel = preview.dirCount > 0
					? ` in ${preview.dirCount + 1} folders`
					: "";
				parts.push(`${fileLabel}${dirLabel} on disk`);
			}
			if (preview.hasSessions) {
				parts.push(preview.sessionCount === 1 ? "1 chat" : `${preview.sessionCount} chats`);
			}

			if (parts.length === 0) {
				return {
					body: `Remove "${preview.title}" from the workspace list? The folder is empty and there are no chats to delete.`,
					strong: false,
				};
			}

			const inventory = parts.join(" and ");
			return {
				body: `This workspace still has ${inventory}. Deleting "${preview.title}" will permanently remove the workspace, all files in ${preview.path}, and all chat history in this workspace.`,
				strong: true,
			};
		}

		function findDescriptionHost(dialog) {
			const candidates = [...dialog.querySelectorAll("p,div,span")];
			for (const node of candidates) {
				const text = (node.textContent || "").replace(/\s+/g, " ").trim();
				if (!text) continue;
				if (/session logs will be kept/i.test(text)) return node;
				if (/removes? .+ from the workspace list/i.test(text)) return node;
				if (/delete workspace/i.test(text) && text.length < 220) return node;
			}
			return dialog.querySelector("p") || dialog.querySelector("[class*='desc']");
		}

		function findConfirmButton(dialog) {
			const buttons = [...dialog.querySelectorAll("button")];
			return buttons.find((btn) => {
				const label = (btn.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
				return label === "delete" || label === "delete workspace" || label.startsWith("delete ");
			}) || null;
		}

		function findCancelButton(dialog) {
			const buttons = [...dialog.querySelectorAll("button")];
			return buttons.find((btn) => {
				const label = (btn.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
				return label === "cancel";
			}) || null;
		}

		function isDeleteWorkspaceDialog(node) {
			if (!(node instanceof Element)) return false;
			const dialog = node.matches("[role='dialog'],[aria-modal='true']")
				? node
				: node.querySelector?.("[role='dialog'],[aria-modal='true']");
			if (!(dialog instanceof Element)) return false;
			const text = (dialog.textContent || "").replace(/\s+/g, " ").trim();
			return /delete workspace/i.test(text)
				|| /session logs will be kept/i.test(text)
				|| /from the workspace list/i.test(text);
		}

		const inject = ["connection", "workspaces"];

		function apply(ctx) {
			ensureStyles();
			try {
				document.documentElement.setAttribute("data-dsh-workspace-delete", "0.1.0");
			} catch { /* ignore */ }

			ctx.inject(["connection", "workspaces"], (scope) => {
				const connection = scope.connection || scope.get?.("connection");
				const workspaces = scope.workspaces || scope.get("workspaces");
				if (!connection?.rpc?.call || !workspaces?.list) {
					console.warn(`[${PLUGIN}] connection/workspaces unavailable`);
					return;
				}

				/** @type {string | null} */
				let pendingWorkspaceId = null;
				/** @type {string | null} */
				let pendingWorkspacePath = null;
				const enhanced = new WeakSet();

				const rememberWorkspaceRow = (target) => {
					const row = target instanceof Element
						? target.closest('[role="treeitem"][aria-expanded], [class*="_projectRow"], [data-dsh-sf-cwd]')
						: null;
					if (!(row instanceof Element)) return;
					const cwd = row.getAttribute("data-dsh-sf-cwd");
					if (cwd) pendingWorkspacePath = cwd;
					const label = (row.textContent || "").replace(/\s+/g, " ").trim();
					const id = resolveWorkspaceId(workspaces, label, cwd);
					if (id) pendingWorkspaceId = id;
				};

				const enhanceDialog = async (dialog) => {
					if (!(dialog instanceof Element) || enhanced.has(dialog)) return;
					const parsed = parseDialogTarget(dialog);
					const workspaceId = pendingWorkspaceId
						|| resolveWorkspaceId(workspaces, parsed.title, pendingWorkspacePath);
					if (!workspaceId) return;

					enhanced.add(dialog);
					const host = findDescriptionHost(dialog);
					if (!host) return;

					host.classList.add("dwd_warn");
					host.textContent = "Checking workspace contents…";

					let preview;
					try {
						preview = await callRpc(connection, "preview", { workspaceId });
					} catch (err) {
						host.textContent = err?.message || String(err);
						host.classList.add("dwd_error");
						return;
					}

					const warning = buildWarning(preview);
					host.textContent = warning.body;
					if (warning.strong) host.classList.add("dwd_warnStrong");

					let meta = dialog.querySelector(".dwd_meta");
					if (!meta) {
						meta = document.createElement("div");
						meta.className = "dwd_meta";
						host.insertAdjacentElement("afterend", meta);
					}
					meta.textContent = preview.hasFiles || preview.hasSessions
						? "This cannot be undone."
						: "";

					const confirmBtn = findConfirmButton(dialog);
					if (!confirmBtn || confirmBtn.dataset.dwdBound === "1") return;
					confirmBtn.dataset.dwdBound = "1";

					const onConfirm = async (event) => {
						event.preventDefault();
						event.stopPropagation();
						if (typeof event.stopImmediatePropagation === "function") {
							event.stopImmediatePropagation();
						}
						if (confirmBtn.disabled) return;
						confirmBtn.disabled = true;
						const prevLabel = confirmBtn.textContent;
						confirmBtn.textContent = "Deleting…";
						try {
							await callRpc(connection, "delete", { workspaceId });
							const cancelBtn = findCancelButton(dialog);
							if (cancelBtn instanceof HTMLButtonElement) cancelBtn.click();
							else dialog.querySelector("button")?.click();
						} catch (err) {
							confirmBtn.disabled = false;
							confirmBtn.textContent = prevLabel || "Delete";
							host.textContent = err?.message || String(err);
							host.classList.add("dwd_error");
						}
					};

					confirmBtn.addEventListener("click", onConfirm, true);
				};

				scope.effect(() => {
					const onPointerDown = (event) => {
						if (event.target instanceof Element) rememberWorkspaceRow(event.target);
					};

					const onClick = (event) => {
						if (!(event.target instanceof Element)) return;
						const item = event.target.closest('[role="menuitem"],button,div,span');
						const label = (item?.textContent || "").replace(/\s+/g, " ").trim();
						if (/delete workspace/i.test(label)) rememberWorkspaceRow(event.target);
					};

					const observer = new MutationObserver((records) => {
						for (const record of records) {
							for (const node of record.addedNodes) {
								if (!(node instanceof Element)) continue;
								if (isDeleteWorkspaceDialog(node)) {
									void enhanceDialog(node.matches("[role='dialog'],[aria-modal='true']") ? node : node.querySelector("[role='dialog'],[aria-modal='true']"));
								}
							}
						}
					});

					document.addEventListener("pointerdown", onPointerDown, true);
					document.addEventListener("click", onClick, true);
					observer.observe(document.body, { childList: true, subtree: true });

					for (const dialog of document.querySelectorAll("[role='dialog'],[aria-modal='true']")) {
						if (isDeleteWorkspaceDialog(dialog)) void enhanceDialog(dialog);
					}

					return () => {
						document.removeEventListener("pointerdown", onPointerDown, true);
						document.removeEventListener("click", onClick, true);
						observer.disconnect();
					};
				}, `${PLUGIN}: delete confirm`);
			});
		}

		return { apply, inject };
	},
});
