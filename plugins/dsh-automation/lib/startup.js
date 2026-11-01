import { Command, Option } from "commander";
import { parseCmdline } from "@deepseek-ai/dsh-cmdline";
//#region lib/types/startup/management.js
/** Bounded query, queue control, retry, and retention command registration. */
function registerManagementCommands(program, ctx) {
	program.command("list").description("Query a bounded page of durable Runs").addOption(new Option("--state <state>", "filter by state").choices([
		"queued",
		"claimed",
		"running",
		"cancelling",
		"succeeded",
		"failed",
		"cancelled",
		"indeterminate"
	])).option("--trigger-kind <kind>", "filter by Trigger adapter kind").option("--trigger-source <id>", "filter by Trigger source id").option("--limit <count>", "page size (maximum 200)", positiveInteger$1, 50).option("--before-created-at <epoch-ms>", "next-page cursor creation time", nonNegativeInteger).option("--before-id <run-id>", "next-page cursor Run id").option("--json", "print machine-readable JSON", false).action((options) => {
		if (options.beforeCreatedAt === void 0 !== (options.beforeId === void 0)) program.error("error: --before-created-at and --before-id must be supplied together");
		publish(ctx, {
			mode: "list",
			limit: options.limit,
			json: options.json,
			...options.state === void 0 ? {} : { state: options.state },
			...options.triggerKind === void 0 ? {} : { triggerKind: requiredText$1(options.triggerKind, "--trigger-kind") },
			...options.triggerSource === void 0 ? {} : { triggerSourceId: requiredText$1(options.triggerSource, "--trigger-source") },
			...options.beforeCreatedAt === void 0 ? {} : {
				beforeCreatedAt: options.beforeCreatedAt,
				beforeId: requiredText$1(options.beforeId, "--before-id")
			}
		});
	});
	program.command("events").description("Read the durable global Run event feed").option("--after-seq <sequence>", "exclusive global event cursor", nonNegativeInteger, 0).option("--run-id <run-id>", "filter by Run id").option("--trigger-kind <kind>", "filter by Trigger adapter kind").option("--trigger-source <id>", "filter by Trigger source id").option("--limit <count>", "page size (maximum 200)", positiveInteger$1, 50).option("--json", "print machine-readable JSON", false).action((options) => {
		publish(ctx, {
			mode: "events",
			afterSeq: options.afterSeq,
			limit: options.limit,
			json: options.json,
			...options.runId === void 0 ? {} : { runId: requiredText$1(options.runId, "--run-id") },
			...options.triggerKind === void 0 ? {} : { triggerKind: requiredText$1(options.triggerKind, "--trigger-kind") },
			...options.triggerSource === void 0 ? {} : { triggerSourceId: requiredText$1(options.triggerSource, "--trigger-source") }
		});
	});
	registerConsumerCommands(program, ctx);
	registerQueueCommands(program, ctx);
	registerRunCommands(program, ctx);
}
function registerConsumerCommands(program, ctx) {
	program.command("consumers").description("List durable event-feed consumer checkpoints").option("--json", "print machine-readable JSON", false).action((options) => {
		publish(ctx, {
			mode: "consumer-list",
			json: options.json
		});
	});
	program.command("consumer-checkpoint").description("Advance one event-feed consumer checkpoint").argument("<consumer-id>").argument("<sequence>", "processed global event sequence", nonNegativeInteger).option("--json", "print machine-readable JSON", false).action((consumerId, seq, options) => {
		publish(ctx, {
			mode: "consumer-checkpoint",
			consumerId: requiredText$1(consumerId, "consumer-id"),
			seq,
			json: options.json
		});
	});
	program.command("consumer-remove").description("Unregister an event-feed consumer so it no longer protects retention").argument("<consumer-id>").option("--json", "print machine-readable JSON", false).action((consumerId, options) => {
		publish(ctx, {
			mode: "consumer-remove",
			consumerId: requiredText$1(consumerId, "consumer-id"),
			json: options.json
		});
	});
	program.command("purge").description("Permanently remove bounded terminal Run bookkeeping protected by consumer cursors").requiredOption("--before <RFC3339-or-epoch-ms>", "exclusive terminal update cutoff", timestamp).option("--limit <count>", "maximum Runs to remove (maximum 1000)", positiveInteger$1, 100).option("--confirm", "confirm permanent automation bookkeeping removal", false).option("--json", "print machine-readable JSON", false).action((options) => {
		if (!options.confirm) program.error("error: purge requires --confirm");
		publish(ctx, {
			mode: "purge",
			before: options.before,
			limit: options.limit,
			json: options.json
		});
	});
}
function registerQueueCommands(program, ctx) {
	program.command("status").description("Check the automation store and print bounded queue health").option("--json", "print machine-readable JSON", false).action((options) => {
		publish(ctx, {
			mode: "status",
			json: options.json
		});
	});
	program.command("pause").description("Pause new Run claims without interrupting active Attempts").option("--reason <text>", "bounded operator reason").option("--json", "print machine-readable JSON", false).action((options) => {
		publish(ctx, {
			mode: "pause",
			json: options.json,
			...options.reason === void 0 ? {} : { reason: requiredText$1(options.reason, "--reason") }
		});
	});
	program.command("resume").description("Resume new Run claims").option("--json", "print machine-readable JSON", false).action((options) => {
		publish(ctx, {
			mode: "resume",
			json: options.json
		});
	});
	program.command("drain").description("Stop new claims and wait for active Attempts to finish").option("--reason <text>", "bounded operator reason").option("--timeout-ms <milliseconds>", "maximum wait before returning an error", positiveInteger$1, 3e4).option("--poll-ms <milliseconds>", "active Attempt polling interval", positiveInteger$1, 250).option("--json", "print machine-readable JSON", false).action((options) => {
		publish(ctx, {
			mode: "drain",
			timeoutMs: options.timeoutMs,
			pollMs: options.pollMs,
			json: options.json,
			...options.reason === void 0 ? {} : { reason: requiredText$1(options.reason, "--reason") }
		});
	});
}
function registerRunCommands(program, ctx) {
	for (const mode of ["show", "cancel"]) program.command(mode).description(mode === "show" ? "Show one Run and its audit events" : "Request Run cancellation").argument("<run-id>").option("--json", "print machine-readable JSON", false).action((runId, options) => {
		publish(ctx, {
			mode,
			runId: requiredText$1(runId, "run-id"),
			json: options.json
		});
	});
	program.command("retry").description("Create a new Run from a failed, cancelled, or explicitly acknowledged indeterminate Run").argument("<run-id>").option("--idempotency-key <key>", "deduplicate this explicit retry request").option("--confirm-indeterminate", "acknowledge that unknown side effects may already exist", false).option("--priority <integer>", "replacement Run priority", safeInteger$1).option("--max-attempts <integer>", "replacement maximum Attempts", positiveInteger$1).option("--json", "print machine-readable JSON", false).action((runId, options) => {
		publish(ctx, {
			mode: "retry",
			runId: requiredText$1(runId, "run-id"),
			confirmIndeterminate: options.confirmIndeterminate,
			json: options.json,
			...options.idempotencyKey === void 0 ? {} : { idempotencyKey: requiredText$1(options.idempotencyKey, "--idempotency-key") },
			...options.priority === void 0 ? {} : { priority: options.priority },
			...options.maxAttempts === void 0 ? {} : { maxAttempts: options.maxAttempts }
		});
	});
}
function publish(ctx, startup) {
	ctx.provide("automationStartup", startup);
}
function safeInteger$1(value) {
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed)) throw new Error("expected a safe integer");
	return parsed;
}
function positiveInteger$1(value) {
	const parsed = safeInteger$1(value);
	if (parsed < 1) throw new Error("expected a positive integer");
	return parsed;
}
function nonNegativeInteger(value) {
	const parsed = safeInteger$1(value);
	if (parsed < 0) throw new Error("expected a non-negative integer");
	return parsed;
}
function timestamp(value) {
	if (/^\d+$/.test(value)) return nonNegativeInteger(value);
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error("expected RFC3339 or epoch milliseconds");
	const parsed = Date.parse(value);
	if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("expected a valid non-negative timestamp");
	return parsed;
}
function requiredText$1(value, name) {
	if (value.trim() === "") throw new Error(`${name} must not be empty`);
	return value;
}
//#endregion
//#region lib/types/startup.js
/** Application-owned command line for the automation profile. */
/** Service published after one valid automation command is parsed. */
const AUTOMATION_STARTUP_SERVICE = "automationStartup";
/** Stable Cordis plugin name. */
const name = "dsh-automation-startup";
/** The startup parser requires the launcher's immutable inner argv. */
const inject = ["cmdlineArgs"];
/** Parse and publish exactly one automation subcommand. */
function apply(ctx) {
	const program = new Command().name("dsh --profile automation").description("Submit, inspect, cancel, and execute durable DSH automation Runs.").showHelpAfterError();
	program.command("worker").description("Run the durable local Worker until the process is stopped").option("--poll-ms <milliseconds>", "queue poll interval", positiveInteger, 1e3).option("--lease-ms <milliseconds>", "Attempt lease duration", positiveInteger, 3e4).option("--worker-id <id>", "stable diagnostic Worker id").option("--slots <count>", "parallel lease-owning Worker slots (maximum 64)", workerSlots, 1).option("--shutdown-grace-ms <milliseconds>", "wait for active turns before cancellation", positiveInteger, 3e4).option("--once", "run one bounded recovery-and-claim cycle, then exit", false).option("--json", "print the --once result as machine-readable JSON", false).action((options) => {
		if (options.json && !options.once) program.error("error: worker --json requires --once");
		if (options.pollMs * 3 >= options.leaseMs) program.error("error: --lease-ms must be greater than three polling intervals");
		ctx.provide(AUTOMATION_STARTUP_SERVICE, {
			mode: "worker",
			pollMs: options.pollMs,
			leaseMs: options.leaseMs,
			slots: options.slots,
			shutdownGraceMs: options.shutdownGraceMs,
			once: options.once,
			json: options.json,
			...options.workerId === void 0 ? {} : { workerId: requiredText(options.workerId, "--worker-id") }
		});
	});
	program.command("submit").description("Persist one Run and exit").argument("<prompt...>", "task text").option("--cwd <path>", "fresh Session workspace", process.cwd()).option("--preset <name>", "DSH Agent preset").option("--provider <name>", "model provider; requires --model").option("--model <id>", "model id; requires --provider").option("--permission <preset>", "permission preset").option("--idempotency-key <key>", "deduplicate within the manual CLI Trigger namespace").option("--priority <integer>", "higher Runs are claimed first", safeInteger, 0).option("--max-attempts <integer>", "maximum automatic Attempts", positiveInteger, 1).option("--concurrency-key <key>", "database-enforced admission group").option("--concurrency-limit <integer>", "maximum active Runs in the admission group", positiveInteger).option("--json", "print machine-readable JSON", false).action((parts, options) => {
		if (options.provider === void 0 !== (options.model === void 0)) program.error("error: --provider and --model must be supplied together");
		const prompt = parts.join(" ").trim();
		if (prompt === "") program.error("error: prompt must not be empty");
		if (options.concurrencyKey === void 0 !== (options.concurrencyLimit === void 0)) program.error("error: --concurrency-key and --concurrency-limit must be supplied together");
		ctx.provide(AUTOMATION_STARTUP_SERVICE, {
			mode: "submit",
			prompt,
			cwd: options.cwd,
			priority: options.priority,
			maxAttempts: options.maxAttempts,
			json: options.json,
			...options.preset === void 0 ? {} : { preset: requiredText(options.preset, "--preset") },
			...options.provider === void 0 ? {} : { provider: requiredText(options.provider, "--provider") },
			...options.model === void 0 ? {} : { model: requiredText(options.model, "--model") },
			...options.permission === void 0 ? {} : { permissionPreset: requiredText(options.permission, "--permission") },
			...options.idempotencyKey === void 0 ? {} : { idempotencyKey: requiredText(options.idempotencyKey, "--idempotency-key") },
			...options.concurrencyKey === void 0 ? {} : {
				concurrencyKey: requiredText(options.concurrencyKey, "--concurrency-key"),
				concurrencyLimit: options.concurrencyLimit
			}
		});
	});
	registerManagementCommands(program, ctx);
	parseCmdline(ctx, program);
}
function safeInteger(value) {
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed)) throw new Error("expected a safe integer");
	return parsed;
}
function positiveInteger(value) {
	const parsed = safeInteger(value);
	if (parsed < 1) throw new Error("expected a positive integer");
	return parsed;
}
function workerSlots(value) {
	const parsed = positiveInteger(value);
	if (parsed > 64) throw new Error("expected an integer between 1 and 64");
	return parsed;
}
function requiredText(value, name) {
	if (value.trim() === "") throw new Error(`${name} must not be empty`);
	return value;
}
//#endregion
export { AUTOMATION_STARTUP_SERVICE, apply, inject, name };
