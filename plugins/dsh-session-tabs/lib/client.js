// Absorbed into dsh-hero-tools (shared workbench tab chrome).
// Kept as a no-op so old profile links / caches do not 404.
window.__ModuleLoader__.load({
	id: "dsh-session-tabs",
	factory: () => {
		const inject = ["slots"];
		function apply() {
			/* no-op — see dsh-hero-tools */
		}
		return { apply, inject };
	},
});
