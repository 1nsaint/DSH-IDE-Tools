/** Application-owned command line for the automation profile. */
import { Command } from 'commander';
import { parseCmdline } from '@deepseek-ai/dsh-cmdline';
import { registerManagementCommands } from "./startup/management.js";
/** Service published after one valid automation command is parsed. */
export const AUTOMATION_STARTUP_SERVICE = 'automationStartup';
/** Stable Cordis plugin name. */
export const name = 'dsh-automation-startup';
/** The startup parser requires the launcher's immutable inner argv. */
export const inject = ['cmdlineArgs'];
/** Parse and publish exactly one automation subcommand. */
export function apply(ctx) {
    const program = new Command()
        .name('dsh --profile automation')
        .description('Submit, inspect, cancel, and execute durable DSH automation Runs.')
        .showHelpAfterError();
    program.command('worker')
        .description('Run the durable local Worker until the process is stopped')
        .option('--poll-ms <milliseconds>', 'queue poll interval', positiveInteger, 1_000)
        .option('--lease-ms <milliseconds>', 'Attempt lease duration', positiveInteger, 30_000)
        .option('--worker-id <id>', 'stable diagnostic Worker id')
        .option('--slots <count>', 'parallel lease-owning Worker slots (maximum 64)', workerSlots, 1)
        .option('--shutdown-grace-ms <milliseconds>', 'wait for active turns before cancellation', positiveInteger, 30_000)
        .option('--once', 'run one bounded recovery-and-claim cycle, then exit', false)
        .option('--json', 'print the --once result as machine-readable JSON', false)
        .action((options) => {
        if (options.json && !options.once) {
            program.error('error: worker --json requires --once');
        }
        if (options.pollMs * 3 >= options.leaseMs) {
            program.error('error: --lease-ms must be greater than three polling intervals');
        }
        ctx.provide(AUTOMATION_STARTUP_SERVICE, {
            mode: 'worker', pollMs: options.pollMs, leaseMs: options.leaseMs, slots: options.slots,
            shutdownGraceMs: options.shutdownGraceMs, once: options.once, json: options.json,
            ...(options.workerId === undefined ? {} : { workerId: requiredText(options.workerId, '--worker-id') }),
        });
    });
    program.command('submit')
        .description('Persist one Run and exit')
        .argument('<prompt...>', 'task text')
        .option('--cwd <path>', 'fresh Session workspace', process.cwd())
        .option('--preset <name>', 'DSH Agent preset')
        .option('--provider <name>', 'model provider; requires --model')
        .option('--model <id>', 'model id; requires --provider')
        .option('--permission <preset>', 'permission preset')
        .option('--idempotency-key <key>', 'deduplicate within the manual CLI Trigger namespace')
        .option('--priority <integer>', 'higher Runs are claimed first', safeInteger, 0)
        .option('--max-attempts <integer>', 'maximum automatic Attempts', positiveInteger, 1)
        .option('--concurrency-key <key>', 'database-enforced admission group')
        .option('--concurrency-limit <integer>', 'maximum active Runs in the admission group', positiveInteger)
        .option('--json', 'print machine-readable JSON', false)
        .action((parts, options) => {
        if ((options.provider === undefined) !== (options.model === undefined)) {
            program.error('error: --provider and --model must be supplied together');
        }
        const prompt = parts.join(' ').trim();
        if (prompt === '')
            program.error('error: prompt must not be empty');
        if ((options.concurrencyKey === undefined) !== (options.concurrencyLimit === undefined)) {
            program.error('error: --concurrency-key and --concurrency-limit must be supplied together');
        }
        ctx.provide(AUTOMATION_STARTUP_SERVICE, {
            mode: 'submit',
            prompt,
            cwd: options.cwd,
            priority: options.priority,
            maxAttempts: options.maxAttempts,
            json: options.json,
            ...(options.preset === undefined ? {} : { preset: requiredText(options.preset, '--preset') }),
            ...(options.provider === undefined ? {} : { provider: requiredText(options.provider, '--provider') }),
            ...(options.model === undefined ? {} : { model: requiredText(options.model, '--model') }),
            ...(options.permission === undefined ? {} : { permissionPreset: requiredText(options.permission, '--permission') }),
            ...(options.idempotencyKey === undefined ? {} : { idempotencyKey: requiredText(options.idempotencyKey, '--idempotency-key') }),
            ...(options.concurrencyKey === undefined ? {} : {
                concurrencyKey: requiredText(options.concurrencyKey, '--concurrency-key'), concurrencyLimit: options.concurrencyLimit,
            }),
        });
    });
    registerManagementCommands(program, ctx);
    parseCmdline(ctx, program);
}
function safeInteger(value) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed))
        throw new Error('expected a safe integer');
    return parsed;
}
function positiveInteger(value) {
    const parsed = safeInteger(value);
    if (parsed < 1)
        throw new Error('expected a positive integer');
    return parsed;
}
function workerSlots(value) {
    const parsed = positiveInteger(value);
    if (parsed > 64)
        throw new Error('expected an integer between 1 and 64');
    return parsed;
}
function requiredText(value, name) {
    if (value.trim() === '')
        throw new Error(`${name} must not be empty`);
    return value;
}
//# sourceMappingURL=startup.js.map