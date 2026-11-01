import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Schedule builder: one-time calendar, or recurring presets (hourly / interval / daily / weekly / monthly).
 * @module
 */
import { useMemo, useState } from 'react';
import pickerCss from './schedule-picker.module.css';
import { TimezoneSelect } from "./TimezoneSelect.js";
const DOW_VALUES = [0, 1, 2, 3, 4, 5, 6];
const INTERVAL_HOURS = [1, 2, 3, 4, 6, 8, 12];
function pad2(n) {
    return String(n).padStart(2, '0');
}
function dateKey(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function parseAtLocal(at) {
    if (!at) {
        const d = new Date();
        d.setMinutes(d.getMinutes() + 30, 0, 0);
        return { date: dateKey(d), hour: d.getHours(), minute: d.getMinutes() };
    }
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) {
        const now = new Date();
        return { date: dateKey(now), hour: 9, minute: 0 };
    }
    return { date: dateKey(d), hour: d.getHours(), minute: d.getMinutes() };
}
export function combineAtLocal(date, hour, minute) {
    return `${date}T${pad2(hour)}:${pad2(minute)}`;
}
export function defaultAtLocal() {
    const { date, hour, minute } = parseAtLocal('');
    return combineAtLocal(date, hour, minute);
}
function parseIntField(value, fallback) {
    const n = Number.parseInt(value ?? '', 10);
    return Number.isFinite(n) ? n : fallback;
}
function parseRecurringCron(expr) {
    const parts = expr.trim().split(/\s+/);
    if (parts.length < 5) {
        return { pattern: 'daily', minute: 0, hour: 9, intervalHours: 6, daysOfWeek: null, dayOfMonth: 1 };
    }
    const minute = parseIntField(parts[0], 0);
    const hourField = parts[1] ?? '9';
    const dom = parts[2] ?? '*';
    const month = parts[3] ?? '*';
    const dowField = parts[4] ?? '*';
    if (hourField.startsWith('*/')) {
        const intervalHours = parseIntField(hourField.slice(2), 6);
        return { pattern: 'interval', minute, hour: 0, intervalHours, daysOfWeek: null, dayOfMonth: 1 };
    }
    if (hourField === '*' && dom === '*' && month === '*' && dowField === '*') {
        return { pattern: 'hourly', minute, hour: 0, intervalHours: 1, daysOfWeek: null, dayOfMonth: 1 };
    }
    if (dom !== '*' && month === '*' && dowField === '*') {
        return {
            pattern: 'monthly',
            minute,
            hour: parseIntField(hourField, 9),
            intervalHours: 6,
            daysOfWeek: null,
            dayOfMonth: Math.min(31, Math.max(1, parseIntField(dom, 1))),
        };
    }
    if (dom === '*' && month === '*' && dowField !== '*') {
        const days = new Set();
        for (const chunk of dowField.split(',')) {
            if (chunk.includes('-')) {
                const [aStr, bStr] = chunk.split('-');
                const a = parseIntField(aStr, 0);
                const b = parseIntField(bStr, 0);
                for (let i = a; i <= b; i += 1)
                    days.add(i);
            }
            else {
                const v = parseIntField(chunk, -1);
                if (v >= 0)
                    days.add(v);
            }
        }
        return {
            pattern: 'weekly',
            minute,
            hour: parseIntField(hourField, 9),
            intervalHours: 6,
            daysOfWeek: days.size ? days : new Set([1, 2, 3, 4, 5]),
            dayOfMonth: 1,
        };
    }
    if (dom === '*' && month === '*' && dowField === '*') {
        return { pattern: 'daily', minute, hour: parseIntField(hourField, 9), intervalHours: 6, daysOfWeek: null, dayOfMonth: 1 };
    }
    return {
        pattern: 'custom',
        minute,
        hour: parseIntField(hourField, 9),
        intervalHours: 6,
        daysOfWeek: null,
        dayOfMonth: 1,
    };
}
function buildRecurringCron(state) {
    const m = Number.isFinite(state.minute) ? state.minute : 0;
    switch (state.pattern) {
        case 'hourly':
            return `${m} * * * *`;
        case 'interval': {
            const n = Math.min(24, Math.max(1, state.intervalHours));
            return `${m} */${n} * * *`;
        }
        case 'daily':
            return `${m} ${state.hour} * * *`;
        case 'weekly': {
            const days = state.daysOfWeek && state.daysOfWeek.size > 0
                ? [...state.daysOfWeek].sort((a, b) => a - b).join(',')
                : '1,2,3,4,5';
            return `${m} ${state.hour} * * ${days}`;
        }
        case 'monthly':
            return `${m} ${state.hour} ${Math.min(31, Math.max(1, state.dayOfMonth))} * *`;
        case 'custom':
        default:
            return `${m} ${state.hour} * * *`;
    }
}
function weekdayLabels() {
    const base = new Date(2024, 0, 7);
    return DOW_VALUES.map((_, i) => {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d);
    });
}
function monthMatrix(view) {
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const rows = [];
    const cursor = new Date(start);
    for (let r = 0; r < 6; r += 1) {
        const row = [];
        for (let c = 0; c < 7; c += 1) {
            row.push({ date: new Date(cursor), inMonth: cursor.getMonth() === month });
            cursor.setDate(cursor.getDate() + 1);
        }
        rows.push(row);
    }
    return rows;
}
function TimeRow(props) {
    const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
    const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), []);
    return (_jsxs("div", { className: pickerCss.timeRow, children: [_jsx("span", { className: pickerCss.timeLabel, children: props.label }), _jsxs("div", { className: pickerCss.timeInputs, children: [!props.minuteOnly && (_jsxs(_Fragment, { children: [_jsx("select", { className: pickerCss.timeSelect, value: props.hour, "aria-label": "Hour", onChange: e => { props.onHour(Number.parseInt(e.target.value, 10)); }, children: hours.map(h => (_jsx("option", { value: h, children: pad2(h) }, h))) }), _jsx("span", { className: pickerCss.timeSep, children: ":" })] })), _jsx("select", { className: pickerCss.timeSelect, value: props.minute - (props.minute % 5), "aria-label": "Minute", onChange: e => { props.onMinute(Number.parseInt(e.target.value, 10)); }, children: minutes.map(mv => (_jsx("option", { value: mv, children: pad2(mv) }, mv))) })] })] }));
}
export function SchedulePicker(props) {
    const { kind, cron, timeZone, at, onKindChange, onChange, t } = props;
    const recurring = useMemo(() => parseRecurringCron(cron), [cron]);
    const parsedAt = useMemo(() => parseAtLocal(at), [at]);
    const [monthView, setMonthView] = useState(() => {
        const d = new Date(`${parsedAt.date}T12:00:00`);
        return Number.isNaN(d.getTime()) ? new Date() : d;
    });
    const [showAdvancedCron, setShowAdvancedCron] = useState(() => recurring.pattern === 'custom');
    const weekdays = useMemo(() => weekdayLabels(), []);
    const matrix = useMemo(() => monthMatrix(monthView), [monthView]);
    const patchRecurring = (patch) => {
        const next = { ...recurring, ...patch };
        if (patch.pattern && patch.pattern !== 'custom') {
            onChange({ cron: buildRecurringCron(next) });
            return;
        }
        onChange({ cron: buildRecurringCron(next) });
    };
    const setAtParts = (date, hour, minute) => {
        onChange({ at: combineAtLocal(date, hour, minute) });
    };
    const monthTitle = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(monthView);
    const toggleDay = (dow) => {
        const base = recurring.daysOfWeek ?? new Set([1, 2, 3, 4, 5]);
        const next = new Set(base);
        if (next.has(dow))
            next.delete(dow);
        else
            next.add(dow);
        patchRecurring({ pattern: 'weekly', daysOfWeek: next.size ? next : new Set([dow]) });
    };
    return (_jsxs("div", { className: pickerCss.panel, children: [_jsxs("fieldset", { className: pickerCss.fieldset, children: [_jsx("legend", { children: t('fieldScheduleType') }), _jsx("div", { className: pickerCss.segmented, children: ['cron', 'at'].map(k => (_jsx("button", { type: "button", className: kind === k ? pickerCss.segmentActive : undefined, "aria-pressed": kind === k, onClick: () => { onKindChange(k); }, children: t(`kind.${k}`) }, k))) })] }), kind === 'at' ? (_jsxs("div", { className: pickerCss.onceGrid, children: [_jsxs("div", { className: pickerCss.calendar, children: [_jsxs("div", { className: pickerCss.calHead, children: [_jsx("button", { type: "button", className: pickerCss.calNav, "aria-label": "Previous month", onClick: () => { setMonthView(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }, children: "\u2039" }), _jsx("span", { className: pickerCss.calTitle, children: monthTitle }), _jsx("button", { type: "button", className: pickerCss.calNav, "aria-label": "Next month", onClick: () => { setMonthView(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }, children: "\u203A" })] }), _jsx("div", { className: pickerCss.calWeekdays, children: weekdays.map(w => (_jsx("span", { className: pickerCss.calWeekday, children: w }, w))) }), _jsx("div", { className: pickerCss.calGrid, children: matrix.flat().map(({ date, inMonth }) => {
                                    const key = dateKey(date);
                                    const selected = key === parsedAt.date;
                                    return (_jsx("button", { type: "button", disabled: !inMonth, className: `${pickerCss.calDay}${selected ? ` ${pickerCss.calDaySelected}` : ''}${!inMonth ? ` ${pickerCss.calDayMuted}` : ''}`, onClick: () => { setAtParts(key, parsedAt.hour, parsedAt.minute); }, children: date.getDate() }, key + String(inMonth)));
                                }) })] }), _jsxs("div", { className: pickerCss.onceSide, children: [_jsx(TimeRow, { label: t('fieldTime'), hour: parsedAt.hour, minute: parsedAt.minute, onHour: h => { setAtParts(parsedAt.date, h, parsedAt.minute); }, onMinute: m => { setAtParts(parsedAt.date, parsedAt.hour, m); } }), _jsx("p", { className: pickerCss.hint, children: t('atHint') }), _jsx(TimezoneSelect, { value: timeZone, label: t('fieldTimeZone'), hint: t('timeZoneHint'), onChange: tz => { onChange({ timeZone: tz }); } })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("label", { className: pickerCss.tzField, children: [_jsx("span", { children: t('recurPattern') }), _jsxs("select", { className: pickerCss.patternSelect, value: recurring.pattern === 'custom' ? 'custom' : recurring.pattern, onChange: (e) => {
                                    const pattern = e.target.value;
                                    if (pattern === 'custom') {
                                        setShowAdvancedCron(true);
                                        patchRecurring({ pattern: 'custom' });
                                        return;
                                    }
                                    setShowAdvancedCron(false);
                                    patchRecurring({
                                        pattern,
                                        daysOfWeek: pattern === 'weekly' ? (recurring.daysOfWeek ?? new Set([1, 2, 3, 4, 5])) : null,
                                    });
                                }, children: [_jsx("option", { value: "hourly", children: t('recurHourly') }), _jsx("option", { value: "interval", children: t('recurInterval') }), _jsx("option", { value: "daily", children: t('recurDaily') }), _jsx("option", { value: "weekly", children: t('recurWeekly') }), _jsx("option", { value: "monthly", children: t('recurMonthly') }), _jsx("option", { value: "custom", children: t('recurAdvanced') })] })] }), recurring.pattern === 'interval' && (_jsxs(_Fragment, { children: [_jsxs("label", { className: pickerCss.tzField, children: [_jsx("span", { children: t('fieldIntervalHours') }), _jsx("select", { className: pickerCss.patternSelect, value: recurring.intervalHours, onChange: e => { patchRecurring({ pattern: 'interval', intervalHours: Number.parseInt(e.target.value, 10) }); }, children: INTERVAL_HOURS.map(n => (_jsx("option", { value: n, children: t('intervalHoursOption', { count: n }) }, n))) })] }), _jsx(TimeRow, { label: t('fieldAtMinute'), hour: 0, minute: recurring.minute, minuteOnly: true, onHour: () => { }, onMinute: m => { patchRecurring({ pattern: 'interval', minute: m }); } })] })), recurring.pattern === 'hourly' && (_jsx(TimeRow, { label: t('fieldAtMinute'), hour: 0, minute: recurring.minute, minuteOnly: true, onHour: () => { }, onMinute: m => { patchRecurring({ pattern: 'hourly', minute: m }); } })), (recurring.pattern === 'daily' || recurring.pattern === 'weekly' || recurring.pattern === 'monthly') && (_jsx(TimeRow, { label: t('fieldTime'), hour: recurring.hour, minute: recurring.minute, onHour: h => { patchRecurring({ hour: h }); }, onMinute: m => { patchRecurring({ minute: m }); } })), recurring.pattern === 'weekly' && (_jsxs("div", { className: pickerCss.dowRow, children: [_jsx("span", { className: pickerCss.timeLabel, children: t('fieldDays') }), _jsx("div", { className: pickerCss.dowChips, role: "group", "aria-label": t('fieldDays'), children: DOW_VALUES.map((dow, i) => {
                                    const on = recurring.daysOfWeek?.has(dow) ?? false;
                                    return (_jsx("button", { type: "button", className: `${pickerCss.dowChip}${on ? ` ${pickerCss.dowChipOn}` : ''}`, "aria-pressed": on, onClick: () => { toggleDay(dow); }, children: weekdays[i]?.slice(0, 2) ?? dow }, dow));
                                }) })] })), recurring.pattern === 'monthly' && (_jsxs("label", { className: pickerCss.tzField, children: [_jsx("span", { children: t('fieldDayOfMonth') }), _jsx("select", { className: pickerCss.patternSelect, value: recurring.dayOfMonth, onChange: e => { patchRecurring({ pattern: 'monthly', dayOfMonth: Number.parseInt(e.target.value, 10) }); }, children: Array.from({ length: 31 }, (_, i) => i + 1).map(d => (_jsx("option", { value: d, children: d }, d))) })] })), _jsx(TimezoneSelect, { value: timeZone, label: t('fieldTimeZone'), hint: t('timeZoneHint'), onChange: tz => { onChange({ timeZone: tz }); } }), (showAdvancedCron || recurring.pattern === 'custom') && (_jsxs("label", { className: pickerCss.tzField, children: [_jsx("span", { children: t('fieldCron') }), _jsx("input", { value: cron, spellCheck: false, onChange: e => { onChange({ cron: e.target.value }); } }), _jsx("small", { children: t('cronHint') })] })), recurring.pattern !== 'custom' && !showAdvancedCron && (_jsx("button", { type: "button", className: pickerCss.advancedToggle, onClick: () => { setShowAdvancedCron(true); }, children: t('recurAdvanced') }))] }))] }));
}
//# sourceMappingURL=schedule-picker.js.map