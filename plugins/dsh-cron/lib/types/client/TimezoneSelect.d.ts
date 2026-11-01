/**
 * IANA time zone dropdown for scheduled tasks.
 * @module
 */
import { type JSX } from 'react';
export interface TimezoneSelectProps {
    readonly value: string;
    readonly label: string;
    readonly hint?: string | undefined;
    readonly onChange: (timeZone: string) => void;
}
export declare function TimezoneSelect({ value, label, hint, onChange }: TimezoneSelectProps): JSX.Element;
//# sourceMappingURL=TimezoneSelect.d.ts.map