import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * IANA time zone dropdown for scheduled tasks.
 * @module
 */
import { useMemo } from 'react';
import pickerCss from './schedule-picker.module.css';
import { listIanaTimeZones, resolveTimeZoneChoice } from "./timezones.js";
export function TimezoneSelect({ value, label, hint, onChange }) {
    const zones = useMemo(() => listIanaTimeZones(), []);
    const selected = useMemo(() => resolveTimeZoneChoice(value, zones), [value, zones]);
    const showCustom = Boolean(value.trim()) && !zones.includes(value.trim()) && value.trim() !== selected;
    return (_jsxs("label", { className: pickerCss.tzField, children: [_jsx("span", { children: label }), _jsxs("select", { className: pickerCss.tzSelect, value: showCustom ? value.trim() : selected, onChange: e => { onChange(e.target.value); }, children: [showCustom ? (_jsx("option", { value: value.trim(), children: value.trim() })) : null, zones.map(zone => (_jsx("option", { value: zone, children: zone }, zone)))] }), hint ? _jsx("small", { children: hint }) : null] }));
}
//# sourceMappingURL=TimezoneSelect.js.map