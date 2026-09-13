/**
 * dsh-runtime-clock — host-only.
 *
 * Contributes a runtime-context snapshot with the local calendar date + hour.
 * The agent loop only re-injects runtime context when the snapshot text changes,
 * so this costs ~one user message per hour (or per day), not every prompt.
 * System-prompt prefix stays stable → KV cache friendly.
 */
const name = "dsh-runtime-clock";
const inject = ["systemPrompt"];

const DEFAULT_TIMEZONE = "Europe/Amsterdam";
const DEFAULT_GRANULARITY = "hour";

/**
 * @param {Date} date
 * @param {string} timeZone
 */
function wallParts(date, timeZone) {
	const entries = new Intl.DateTimeFormat("en-GB", {
		timeZone,
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	})
		.formatToParts(date)
		.filter((p) => p.type !== "literal")
		.map((p) => [p.type, p.value]);
	return Object.fromEntries(entries);
}

/**
 * @param {string} timeZone
 * @param {"hour" | "day"} granularity
 */
function formatClock(timeZone, granularity) {
	const parts = wallParts(new Date(), timeZone);
	const datePart = `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`;

	if (granularity === "day") {
		return [
			`Current date (${timeZone}): ${datePart}.`,
			"This is authoritative wall-clock context for this session; prefer it over training priors when answering date-sensitive questions.",
			"For exact time of day, run `date` in the shell.",
		].join(" ");
	}

	const hour = String(parts.hour ?? "00").padStart(2, "0");
	return [
		`Current date/time (${timeZone}): ${datePart}, around ${hour}:00 (hour precision).`,
		"This is authoritative wall-clock context for this session; prefer it over training priors when answering time-sensitive questions (weather, news, “today”, schedules).",
		"For second-level accuracy, run `date` in the shell.",
	].join(" ");
}

/**
 * @param {import("@deepseek-ai/cordis").Context} ctx
 * @param {{ timezone?: string, granularity?: "hour" | "day" }} [config]
 */
function apply(ctx, config = {}) {
	const timeZone =
		(typeof config.timezone === "string" && config.timezone.trim()) ||
		process.env.TZ ||
		DEFAULT_TIMEZONE;
	const granularity =
		config.granularity === "day" || config.granularity === "hour"
			? config.granularity
			: DEFAULT_GRANULARITY;

	ctx.systemPrompt.context({
		name: "runtime:clock",
		order: 40,
		text: () => formatClock(timeZone, granularity),
	});
}

export { apply, inject, name, formatClock };
