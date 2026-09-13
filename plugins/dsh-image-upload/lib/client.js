// Adds /image ("Upload image") to the + commands menu; opens the file picker on pick.
window.__ModuleLoader__.load({
	id: "dsh-image-upload",
	factory: (require) => {
		const PLUGIN = "dsh-image-upload";

		function pickImageFiles(signal) {
			return new Promise((resolve) => {
				if (signal?.aborted) {
					resolve([]);
					return;
				}
				const input = document.createElement("input");
				input.type = "file";
				input.accept = "image/png,image/jpeg,image/webp,image/gif";
				input.multiple = true;
				input.style.cssText = "position:fixed;left:-9999px;opacity:0;pointer-events:none";
				document.body.appendChild(input);

				const finish = (files) => {
					input.remove();
					resolve(files);
				};

				const onAbort = () => finish([]);
				signal?.addEventListener("abort", onAbort, { once: true });

				input.addEventListener("change", () => {
					signal?.removeEventListener("abort", onAbort);
					finish(input.files ? [...input.files] : []);
				}, { once: true });

				input.click();
			});
		}

		function addImageFiles(conversation, inputHub, sessionId, files) {
			if (!files.length) return;
			try {
				const shell = inputHub.shell(sessionId);
				const images = conversation.createDraftImages(files);
				if (!shell.addImages(images.map((image) => image.id))) {
					conversation.releaseDraftImages(images);
				}
			} catch (error) {
				console.warn(`[${PLUGIN}] failed to attach images:`, error);
			}
		}

		const inject = ["commandUi", "conversation", "sessions"];

		function apply(ctx) {
			ctx.inject(["commandUi", "conversation", "sessions"], (scope) => {
				const commandUi = scope.get("commandUi");
				const conversation = scope.get("conversation");
				const sessions = scope.sessions;
				const inputHub = conversation.input;

				scope.effect(() => commandUi.register({
					name: "image",
					description: "Upload image",
					available: (session) => sessions.subagentAddress(session.sessionId) === void 0,
					ui: {
						kind: "popupSelect",
						options: async (session, signal) => {
							const actx = sessions.scope(session.sessionId);
							const popup = actx ? commandUi.popupFor(actx) : null;
							try {
								const files = await pickImageFiles(signal);
								if (!signal.aborted && files.length > 0) {
									addImageFiles(conversation, inputHub, session.sessionId, files);
								}
							} finally {
								popup?.dismiss({ focusComposer: true });
							}
							return [];
						},
						onSelect: async () => {},
					},
				}), `${PLUGIN}: /image contribution`);
			});
		}

		return { apply, inject };
	},
});
