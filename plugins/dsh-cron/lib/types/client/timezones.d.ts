/**
 * Curated IANA time zones for the schedule picker (24 common choices).
 * @module
 */
export declare function listIanaTimeZones(): readonly string[];
export declare function isValidIanaTimeZone(timeZone: string): boolean;
/** Pick a value that works in the zone list (keeps custom valid zones as extra option). */
export declare function resolveTimeZoneChoice(value: string, zones: readonly string[]): string;
//# sourceMappingURL=timezones.d.ts.map