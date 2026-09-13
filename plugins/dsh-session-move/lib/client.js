// dsh-session-move — drop a session onto a workspace folder to transfer it.
window.__ModuleLoader__.load({
	id: "dsh-session-move",
	factory: (require) => {
		const PLUGIN = "dsh-session-move";
		const RPC_CHANNEL = "/session-move";

		const css = `
.dsh-ws-drop-target{
  outline:2px solid var(--dsw-alias-state-business-primary);
  outline-offset:-2px;
  border-radius:8px;
  background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent)!important;
}
.dsh-ws-drop-toast{
  position:fixed;z-index:99999;left:50%;bottom:24px;transform:translateX(-50%);
  max-width:min(480px,92vw);padding:10px 14px;border-radius:10px;font-size:13px;line-height:1.35;
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);
  border:1px solid var(--dsw-alias-border-l2);box-shadow:0 8px 24px rgba(0,0,0,.35);
  pointer-events:none;
}
.dsh-ws-drop-toast.dsh-ws-drop-toastErr{
  border-color:var(--dsw-alias-state-error-primary);
  color:var(--dsw-alias-state-error-primary);
}
`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let t = document.getElementById("dsh-session-move-css");
			if (!t) {
				t = document.createElement("style");
				t.id = "dsh-session-move-css";
				document.head.appendChild(t);
			}
			t.textContent = css;
		}

		function toast(message, isError) {
			document.querySelectorAll(".dsh-ws-drop-toast").forEach((el) => el.remove());
			const el = document.createElement("div");
			el.className = "dsh-ws-drop-toast" + (isError ? " dsh-ws-drop-toastErr" : "");
			el.textContent = message;
			document.body.appendChild(el);
			window.setTimeout(() => el.remove(), isError ? 6000 : 2800);
		}

		async function callRpc(connection, endpoint, payload) {
			const result = await connection.rpc.call(RPC_CHANNEL, endpoint, payload ?? {});
			if (!result.ok) throw new Error(result.error?.message || `${endpoint} failed`);
			return result.value;
		}

		/** Workspace folder rows expose aria-expanded; session rows use aria-selected. */
		function workspaceFolderFromEvent(e) {
			const el = e.target instanceof Element ? e.target : null;
			if (!el) return null;
			return el.closest('[role="treeitem"][aria-expanded]');
		}

		function folderLabel(folderEl) {
			const title = folderEl.querySelector("span");
			// Prefer the longest text span that looks like a name (skip icon-only slots).
			const spans = [...folderEl.querySelectorAll("span")];
			let best = "";
			for (const s of spans) {
				const t = (s.textContent || "").replace(/\s+/g, " ").trim();
				if (t.length > best.length && t.length < 80) best = t;
			}
			return best || (title?.textContent || "").replace(/\s+/g, " ").trim();
		}

		function resolveWorkspaceId(workspaces, folderEl) {
			const label = folderLabel(folderEl);
			if (!label) return null;
			const items = workspaces?.list?.getSnapshot?.()?.items || [];
			const hit = items.find((w) => {
				const title = (w.title || w.name || "").trim();
				return title === label;
			});
			return hit?.workspaceId || hit?.id || null;
		}

		function currentOwnerId(workspaces, sessionId) {
			const items = workspaces?.list?.getSnapshot?.()?.items || [];
			const hit = items.find((w) => Array.isArray(w.sessionIds) && w.sessionIds.includes(sessionId));
			return hit?.workspaceId || hit?.id || null;
		}

		function clearDropTargets() {
			document.querySelectorAll(".dsh-ws-drop-target").forEach((el) => {
				el.classList.remove("dsh-ws-drop-target");
			});
		}

		function apply(ctx) {
			ensureStyles();
			const connection = ctx.connection || ctx.get?.("connection");
			const workspaces = ctx.workspaces || ctx.get?.("workspaces");
			if (!connection?.rpc?.call) {
				console.warn(`[${PLUGIN}] connection.rpc unavailable`);
				return;
			}

			let draggingSessionId = null;
			let busy = false;

			const onDragStart = (e) => {
				const folder = e.target?.closest?.('[role="treeitem"][aria-expanded]');
				if (folder) {
					draggingSessionId = null;
					return;
				}
				const row = e.target?.closest?.('[role="treeitem"]');
				if (!row) {
					draggingSessionId = null;
					return;
				}
				let id = "";
				try {
					id = e.dataTransfer?.getData("text/plain") || "";
				} catch {
					id = "";
				}
				if (id.startsWith("session-")) {
					draggingSessionId = id;
					try {
						e.dataTransfer.setData("application/x-dsh-session-id", id);
					} catch {
						/* ignore */
					}
					return;
				}
				// Capture runs before React sets dataTransfer — mark pending and resolve on dragover/drop.
				draggingSessionId = "__pending__";
				row.setAttribute("data-dsh-dragging-session", "1");
			};

			const onDragEnd = () => {
				document.querySelectorAll("[data-dsh-dragging-session]").forEach((el) => {
					el.removeAttribute("data-dsh-dragging-session");
				});
				draggingSessionId = null;
				clearDropTargets();
			};

			const resolveDraggingSession = (e) => {
				if (draggingSessionId && draggingSessionId.startsWith("session-")) return draggingSessionId;
				for (const type of ["application/x-dsh-session-id", "text/plain"]) {
					try {
						const id = e.dataTransfer?.getData(type) || "";
						if (id.startsWith("session-")) {
							draggingSessionId = id;
							return id;
						}
					} catch {
						/* ignore */
					}
				}
				return null;
			};

			const onDragOver = (e) => {
				const sessionId = resolveDraggingSession(e);
				if (!sessionId) return;
				const folder = workspaceFolderFromEvent(e);
				clearDropTargets();
				if (!folder) return;
				const wsId = resolveWorkspaceId(workspaces, folder);
				if (!wsId) return;
				if (currentOwnerId(workspaces, sessionId) === wsId) return;
				e.preventDefault();
				try {
					e.dataTransfer.dropEffect = "move";
				} catch {
					/* ignore */
				}
				folder.classList.add("dsh-ws-drop-target");
			};

			const onDrop = async (e) => {
				const sessionId = resolveDraggingSession(e);
				if (!sessionId || busy) return;
				const folder = workspaceFolderFromEvent(e);
				document.querySelectorAll("[data-dsh-dragging-session]").forEach((el) => {
					el.removeAttribute("data-dsh-dragging-session");
				});
				if (!folder) return;
				const wsId = resolveWorkspaceId(workspaces, folder);
				clearDropTargets();
				draggingSessionId = null;
				if (!wsId) return;
				if (currentOwnerId(workspaces, sessionId) === wsId) return;

				e.preventDefault();
				e.stopPropagation();
				busy = true;
				const label = folderLabel(folder) || "workspace";
				try {
					const res = await callRpc(connection, "moveToWorkspace", {
						sessionId,
						workspaceId: wsId,
					});
					if (res?.moved === false) {
						toast(`Already in ${res.workspaceTitle || label}`);
					} else {
						toast(`Moved to ${res?.workspaceTitle || label}`);
					}
				} catch (err) {
					toast(err?.message || String(err), true);
				} finally {
					busy = false;
				}
			};

			ctx.effect(() => {
				// Bubble on dragstart so stock has already put sessionId in dataTransfer.
				document.addEventListener("dragstart", onDragStart, false);
				document.addEventListener("dragend", onDragEnd, true);
				document.addEventListener("dragover", onDragOver, true);
				document.addEventListener("drop", onDrop, true);
				return () => {
					document.removeEventListener("dragstart", onDragStart, false);
					document.removeEventListener("dragend", onDragEnd, true);
					document.removeEventListener("dragover", onDragOver, true);
					document.removeEventListener("drop", onDrop, true);
					clearDropTargets();
				};
			}, `${PLUGIN}: workspace drop`);
		}

		const inject = ["connection", "workspaces"];

		return { apply, inject };
	},
});
