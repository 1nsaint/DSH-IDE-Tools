/**
 * Schedule builder: one-time calendar, or recurring presets (hourly / interval / daily / weekly / monthly).
 * @module
 */
import type { CronKey } from './locales.ts';
type ScheduleKind = 'cron' | 'at';
type CronTranslator = (key: CronKey, params?: Record<string, string | number>) => string;
export type SchedulePickerProps = {
    readonly kind: ScheduleKind;
    readonly cron: string;
    readonly timeZone: string;
    readonly at: string;
    readonly onKindChange: (kind: ScheduleKind) => void;
    readonly onChange: (patch: {
        cron?: string;
        timeZone?: string;
        at?: string;
    }) => void;
    readonly t: CronTranslator;
};
export declare function combineAtLocal(date: string, hour: number, minute: number): string;
export declare function defaultAtLocal(): string;
export declare function SchedulePicker(props: SchedulePickerProps): JSX.Element;
export {};
//# sourceMappingURL=schedule-picker.d.ts.map