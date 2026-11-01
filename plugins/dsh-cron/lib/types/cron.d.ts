/**
 * Five-field cron expression parsing and timezone-aware occurrence computation.
 * Zero-dependency; the only platform API used is Intl for IANA time zones.
 * @module dsh-cron/cron
 */
/** Parsed five-field cron schedule. */
export interface CronSpec {
    /** Sorted unique minute values (0-59). */
    readonly minutes: readonly number[];
    /** Sorted unique hour values (0-23). */
    readonly hours: readonly number[];
    /** Sorted unique month values (1-12). */
    readonly months: readonly number[];
    /** Sorted unique day-of-month values (1-31). */
    readonly doms: readonly number[];
    /** Sorted unique day-of-week values (0-6, 0 = Sunday). */
    readonly dows: readonly number[];
    /** True when the day-of-month field was `*`. */
    readonly domUnrestricted: boolean;
    /** True when the day-of-week field was `*`. */
    readonly dowUnrestricted: boolean;
    /** The original expression text. */
    readonly source: string;
}
/** A rejected cron expression, with the offending field named in the message. */
export declare class CronParseError extends Error {
    constructor(message: string);
}
/**
 * Parse a five-field cron expression: minute hour day-of-month month day-of-week.
 * Numeric fields only; day-of-week accepts 0-7 with both 0 and 7 as Sunday.
 * @param expression - the cron expression text.
 * @returns the parsed schedule.
 * @throws {CronParseError} when the expression is malformed.
 */
export declare function parseCronExpression(expression: string): CronSpec;
/** Validate an IANA time zone name. */
export declare function isValidTimeZone(timeZone: string): boolean;
/**
 * Compute the first occurrence strictly after `afterMs`.
 * @param spec - parsed cron schedule.
 * @param afterMs - exclusive lower bound, milliseconds since the epoch.
 * @param timeZone - IANA zone the expression is interpreted in.
 * @returns the occurrence as epoch milliseconds, or null when the schedule has
 *   no occurrence within four leap cycles.
 */
export declare function nextOccurrence(spec: CronSpec, afterMs: number, timeZone: string): number | null;
//# sourceMappingURL=cron.d.ts.map