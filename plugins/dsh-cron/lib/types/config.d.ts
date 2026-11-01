/**
 * Serializable configuration, schema, and direct-call defaults.
 * @module dsh-cron/config
 */
import z from '@deepseek-ai/schemastery';
/** Plugin configuration supplied by the profile composition. */
export interface Config {
    /** Directory holding the durable job store; defaults to the `cron` directory inside the Harness home. */
    dataDir?: string;
    /** IANA time zone for cron schedules that omit one; defaults to the host's local zone. */
    defaultTimeZone?: string;
    /** Maximum number of jobs the store accepts. */
    maxJobs?: number;
    /** Minimum minutes between two occurrences of one recurring job. */
    minIntervalMinutes?: number;
    /** Default absolute workspace for UI/API jobs that do not supply a fresh Session target. */
    defaultCwd?: string;
    /** Durable Automation event-feed reconciliation interval. */
    reconcilePollMs?: number;
    /** Maximum retained occurrence records per job; active records are never trimmed. */
    maxRunHistory?: number;
}
/** Configuration after defaults have been resolved. */
export interface ResolvedConfig {
    /** Directory holding the durable job store, or undefined for the Harness-home default. */
    dataDir?: string;
    /** IANA time zone for cron schedules that omit one. */
    defaultTimeZone: string;
    /** Maximum number of jobs the store accepts. */
    maxJobs: number;
    /** Minimum minutes between two occurrences of one recurring job. */
    minIntervalMinutes: number;
    defaultCwd?: string;
    reconcilePollMs: number;
    maxRunHistory: number;
}
/** Loader-visible configuration schema and defaults. */
export declare const Config: z<Config>;
/** The host's local IANA time zone. */
export declare function hostTimeZone(): string;
/**
 * Resolve the same defaults for direct callers that bypass Cordis Loader.
 * @param config - Partial serialized configuration.
 * @returns Configuration with all defaults applied.
 */
export declare function resolveConfig(config?: Config): ResolvedConfig;
//# sourceMappingURL=config.d.ts.map