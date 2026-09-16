/**
 * Schedule builder: one-time calendar, or recurring presets (hourly / interval / daily / weekly / monthly).
 * @module
 */

import { useMemo, useState } from 'react'
import type { CronKey } from './locales.ts'
import pickerCss from './schedule-picker.module.css'
import { TimezoneSelect } from './TimezoneSelect.tsx'

type ScheduleKind = 'cron' | 'at'

type RecurPattern = 'hourly' | 'interval' | 'daily' | 'weekly' | 'monthly' | 'custom'

type CronTranslator = (key: CronKey, params?: Record<string, string | number>) => string

export type SchedulePickerProps = {
  readonly kind: ScheduleKind
  readonly cron: string
  readonly timeZone: string
  readonly at: string
  readonly onKindChange: (kind: ScheduleKind) => void
  readonly onChange: (patch: { cron?: string, timeZone?: string, at?: string }) => void
  readonly t: CronTranslator
}

const DOW_VALUES = [0, 1, 2, 3, 4, 5, 6] as const
const INTERVAL_HOURS = [1, 2, 3, 4, 6, 8, 12] as const

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function parseAtLocal(at: string): { date: string, hour: number, minute: number } {
  if (!at) {
    const d = new Date()
    d.setMinutes(d.getMinutes() + 30, 0, 0)
    return { date: dateKey(d), hour: d.getHours(), minute: d.getMinutes() }
  }
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) {
    const now = new Date()
    return { date: dateKey(now), hour: 9, minute: 0 }
  }
  return { date: dateKey(d), hour: d.getHours(), minute: d.getMinutes() }
}

export function combineAtLocal(date: string, hour: number, minute: number): string {
  return `${date}T${pad2(hour)}:${pad2(minute)}`
}

export function defaultAtLocal(): string {
  const { date, hour, minute } = parseAtLocal('')
  return combineAtLocal(date, hour, minute)
}

interface RecurringState {
  pattern: RecurPattern
  minute: number
  hour: number
  intervalHours: number
  daysOfWeek: Set<number> | null
  dayOfMonth: number
}

function parseIntField(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isFinite(n) ? n : fallback
}

function parseRecurringCron(expr: string): RecurringState {
  const parts = expr.trim().split(/\s+/)
  if (parts.length < 5) {
    return { pattern: 'daily', minute: 0, hour: 9, intervalHours: 6, daysOfWeek: null, dayOfMonth: 1 }
  }
  const minute = parseIntField(parts[0], 0)
  const hourField = parts[1] ?? '9'
  const dom = parts[2] ?? '*'
  const month = parts[3] ?? '*'
  const dowField = parts[4] ?? '*'

  if (hourField.startsWith('*/')) {
    const intervalHours = parseIntField(hourField.slice(2), 6)
    return { pattern: 'interval', minute, hour: 0, intervalHours, daysOfWeek: null, dayOfMonth: 1 }
  }

  if (hourField === '*' && dom === '*' && month === '*' && dowField === '*') {
    return { pattern: 'hourly', minute, hour: 0, intervalHours: 1, daysOfWeek: null, dayOfMonth: 1 }
  }

  if (dom !== '*' && month === '*' && dowField === '*') {
    return {
      pattern: 'monthly',
      minute,
      hour: parseIntField(hourField, 9),
      intervalHours: 6,
      daysOfWeek: null,
      dayOfMonth: Math.min(31, Math.max(1, parseIntField(dom, 1))),
    }
  }

  if (dom === '*' && month === '*' && dowField !== '*') {
    const days = new Set<number>()
    for (const chunk of dowField.split(',')) {
      if (chunk.includes('-')) {
        const [aStr, bStr] = chunk.split('-')
        const a = parseIntField(aStr, 0)
        const b = parseIntField(bStr, 0)
        for (let i = a; i <= b; i += 1) days.add(i)
      } else {
        const v = parseIntField(chunk, -1)
        if (v >= 0) days.add(v)
      }
    }
    return {
      pattern: 'weekly',
      minute,
      hour: parseIntField(hourField, 9),
      intervalHours: 6,
      daysOfWeek: days.size ? days : new Set([1, 2, 3, 4, 5]),
      dayOfMonth: 1,
    }
  }

  if (dom === '*' && month === '*' && dowField === '*') {
    return { pattern: 'daily', minute, hour: parseIntField(hourField, 9), intervalHours: 6, daysOfWeek: null, dayOfMonth: 1 }
  }

  return {
    pattern: 'custom',
    minute,
    hour: parseIntField(hourField, 9),
    intervalHours: 6,
    daysOfWeek: null,
    dayOfMonth: 1,
  }
}

function buildRecurringCron(state: RecurringState): string {
  const m = Number.isFinite(state.minute) ? state.minute : 0
  switch (state.pattern) {
    case 'hourly':
      return `${m} * * * *`
    case 'interval': {
      const n = Math.min(24, Math.max(1, state.intervalHours))
      return `${m} */${n} * * *`
    }
    case 'daily':
      return `${m} ${state.hour} * * *`
    case 'weekly': {
      const days = state.daysOfWeek && state.daysOfWeek.size > 0
        ? [...state.daysOfWeek].sort((a, b) => a - b).join(',')
        : '1,2,3,4,5'
      return `${m} ${state.hour} * * ${days}`
    }
    case 'monthly':
      return `${m} ${state.hour} ${Math.min(31, Math.max(1, state.dayOfMonth))} * *`
    case 'custom':
    default:
      return `${m} ${state.hour} * * *`
  }
}

function weekdayLabels(): string[] {
  const base = new Date(2024, 0, 7)
  return DOW_VALUES.map((_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d)
  })
}

function monthMatrix(view: Date): Array<Array<{ date: Date, inMonth: boolean }>> {
  const year = view.getFullYear()
  const month = view.getMonth()
  const first = new Date(year, month, 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  const rows: Array<Array<{ date: Date, inMonth: boolean }>> = []
  const cursor = new Date(start)
  for (let r = 0; r < 6; r += 1) {
    const row: Array<{ date: Date, inMonth: boolean }> = []
    for (let c = 0; c < 7; c += 1) {
      row.push({ date: new Date(cursor), inMonth: cursor.getMonth() === month })
      cursor.setDate(cursor.getDate() + 1)
    }
    rows.push(row)
  }
  return rows
}

function TimeRow(props: {
  hour: number
  minute: number
  onHour: (h: number) => void
  onMinute: (m: number) => void
  label: string
  minuteOnly?: boolean
}): JSX.Element {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), [])
  return (
    <div className={pickerCss.timeRow}>
      <span className={pickerCss.timeLabel}>{props.label}</span>
      <div className={pickerCss.timeInputs}>
        {!props.minuteOnly && (
          <>
            <select
              className={pickerCss.timeSelect}
              value={props.hour}
              aria-label="Hour"
              onChange={e => { props.onHour(Number.parseInt(e.target.value, 10)) }}
            >
              {hours.map(h => (
                <option key={h} value={h}>{pad2(h)}</option>
              ))}
            </select>
            <span className={pickerCss.timeSep}>:</span>
          </>
        )}
        <select
          className={pickerCss.timeSelect}
          value={props.minute - (props.minute % 5)}
          aria-label="Minute"
          onChange={e => { props.onMinute(Number.parseInt(e.target.value, 10)) }}
        >
          {minutes.map(mv => (
            <option key={mv} value={mv}>{pad2(mv)}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function SchedulePicker(props: SchedulePickerProps): JSX.Element {
  const { kind, cron, timeZone, at, onKindChange, onChange, t } = props
  const recurring = useMemo(() => parseRecurringCron(cron), [cron])
  const parsedAt = useMemo(() => parseAtLocal(at), [at])
  const [monthView, setMonthView] = useState(() => {
    const d = new Date(`${parsedAt.date}T12:00:00`)
    return Number.isNaN(d.getTime()) ? new Date() : d
  })
  const [showAdvancedCron, setShowAdvancedCron] = useState(() => recurring.pattern === 'custom')
  const weekdays = useMemo(() => weekdayLabels(), [])
  const matrix = useMemo(() => monthMatrix(monthView), [monthView])

  const patchRecurring = (patch: Partial<RecurringState>): void => {
    const next = { ...recurring, ...patch }
    if (patch.pattern && patch.pattern !== 'custom') {
      onChange({ cron: buildRecurringCron(next) })
      return
    }
    onChange({ cron: buildRecurringCron(next) })
  }

  const setAtParts = (date: string, hour: number, minute: number): void => {
    onChange({ at: combineAtLocal(date, hour, minute) })
  }

  const monthTitle = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(monthView)

  const toggleDay = (dow: number): void => {
    const base = recurring.daysOfWeek ?? new Set<number>([1, 2, 3, 4, 5])
    const next = new Set(base)
    if (next.has(dow)) next.delete(dow)
    else next.add(dow)
    patchRecurring({ pattern: 'weekly', daysOfWeek: next.size ? next : new Set([dow]) })
  }

  return (
    <div className={pickerCss.panel}>
      <fieldset className={pickerCss.fieldset}>
        <legend>{t('fieldScheduleType')}</legend>
        <div className={pickerCss.segmented}>
          {(['cron', 'at'] as const).map(k => (
            <button
              key={k}
              type="button"
              className={kind === k ? pickerCss.segmentActive : undefined}
              aria-pressed={kind === k}
              onClick={() => { onKindChange(k) }}
            >
              {t(`kind.${k}`)}
            </button>
          ))}
        </div>
      </fieldset>

      {kind === 'at' ? (
        <div className={pickerCss.onceGrid}>
          <div className={pickerCss.calendar}>
            <div className={pickerCss.calHead}>
              <button
                type="button"
                className={pickerCss.calNav}
                aria-label="Previous month"
                onClick={() => { setMonthView(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)) }}
              >
                ‹
              </button>
              <span className={pickerCss.calTitle}>{monthTitle}</span>
              <button
                type="button"
                className={pickerCss.calNav}
                aria-label="Next month"
                onClick={() => { setMonthView(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)) }}
              >
                ›
              </button>
            </div>
            <div className={pickerCss.calWeekdays}>
              {weekdays.map(w => (
                <span key={w} className={pickerCss.calWeekday}>{w}</span>
              ))}
            </div>
            <div className={pickerCss.calGrid}>
              {matrix.flat().map(({ date, inMonth }) => {
                const key = dateKey(date)
                const selected = key === parsedAt.date
                return (
                  <button
                    key={key + String(inMonth)}
                    type="button"
                    disabled={!inMonth}
                    className={`${pickerCss.calDay}${selected ? ` ${pickerCss.calDaySelected}` : ''}${!inMonth ? ` ${pickerCss.calDayMuted}` : ''}`}
                    onClick={() => { setAtParts(key, parsedAt.hour, parsedAt.minute) }}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
          </div>
          <div className={pickerCss.onceSide}>
            <TimeRow
              label={t('fieldTime')}
              hour={parsedAt.hour}
              minute={parsedAt.minute}
              onHour={h => { setAtParts(parsedAt.date, h, parsedAt.minute) }}
              onMinute={m => { setAtParts(parsedAt.date, parsedAt.hour, m) }}
            />
            <p className={pickerCss.hint}>{t('atHint')}</p>
            <TimezoneSelect
              value={timeZone}
              label={t('fieldTimeZone')}
              hint={t('timeZoneHint')}
              onChange={tz => { onChange({ timeZone: tz }) }}
            />
          </div>
        </div>
      ) : (
        <>
          <label className={pickerCss.tzField}>
            <span>{t('recurPattern')}</span>
            <select
              className={pickerCss.patternSelect}
              value={recurring.pattern === 'custom' ? 'custom' : recurring.pattern}
              onChange={(e) => {
                const pattern = e.target.value as RecurPattern
                if (pattern === 'custom') {
                  setShowAdvancedCron(true)
                  patchRecurring({ pattern: 'custom' })
                  return
                }
                setShowAdvancedCron(false)
                patchRecurring({
                  pattern,
                  daysOfWeek: pattern === 'weekly' ? (recurring.daysOfWeek ?? new Set([1, 2, 3, 4, 5])) : null,
                })
              }}
            >
              <option value="hourly">{t('recurHourly')}</option>
              <option value="interval">{t('recurInterval')}</option>
              <option value="daily">{t('recurDaily')}</option>
              <option value="weekly">{t('recurWeekly')}</option>
              <option value="monthly">{t('recurMonthly')}</option>
              <option value="custom">{t('recurAdvanced')}</option>
            </select>
          </label>

          {recurring.pattern === 'interval' && (
            <>
              <label className={pickerCss.tzField}>
                <span>{t('fieldIntervalHours')}</span>
                <select
                  className={pickerCss.patternSelect}
                  value={recurring.intervalHours}
                  onChange={e => { patchRecurring({ pattern: 'interval', intervalHours: Number.parseInt(e.target.value, 10) }) }}
                >
                  {INTERVAL_HOURS.map(n => (
                    <option key={n} value={n}>{t('intervalHoursOption', { count: n })}</option>
                  ))}
                </select>
              </label>
              <TimeRow
                label={t('fieldAtMinute')}
                hour={0}
                minute={recurring.minute}
                minuteOnly
                onHour={() => {}}
                onMinute={m => { patchRecurring({ pattern: 'interval', minute: m }) }}
              />
            </>
          )}

          {recurring.pattern === 'hourly' && (
            <TimeRow
              label={t('fieldAtMinute')}
              hour={0}
              minute={recurring.minute}
              minuteOnly
              onHour={() => {}}
              onMinute={m => { patchRecurring({ pattern: 'hourly', minute: m }) }}
            />
          )}

          {(recurring.pattern === 'daily' || recurring.pattern === 'weekly' || recurring.pattern === 'monthly') && (
            <TimeRow
              label={t('fieldTime')}
              hour={recurring.hour}
              minute={recurring.minute}
              onHour={h => { patchRecurring({ hour: h }) }}
              onMinute={m => { patchRecurring({ minute: m }) }}
            />
          )}

          {recurring.pattern === 'weekly' && (
            <div className={pickerCss.dowRow}>
              <span className={pickerCss.timeLabel}>{t('fieldDays')}</span>
              <div className={pickerCss.dowChips} role="group" aria-label={t('fieldDays')}>
                {DOW_VALUES.map((dow, i) => {
                  const on = recurring.daysOfWeek?.has(dow) ?? false
                  return (
                    <button
                      key={dow}
                      type="button"
                      className={`${pickerCss.dowChip}${on ? ` ${pickerCss.dowChipOn}` : ''}`}
                      aria-pressed={on}
                      onClick={() => { toggleDay(dow) }}
                    >
                      {weekdays[i]?.slice(0, 2) ?? dow}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {recurring.pattern === 'monthly' && (
            <label className={pickerCss.tzField}>
              <span>{t('fieldDayOfMonth')}</span>
              <select
                className={pickerCss.patternSelect}
                value={recurring.dayOfMonth}
                onChange={e => { patchRecurring({ pattern: 'monthly', dayOfMonth: Number.parseInt(e.target.value, 10) }) }}
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
          )}

          <TimezoneSelect
            value={timeZone}
            label={t('fieldTimeZone')}
            hint={t('timeZoneHint')}
            onChange={tz => { onChange({ timeZone: tz }) }}
          />

          {(showAdvancedCron || recurring.pattern === 'custom') && (
            <label className={pickerCss.tzField}>
              <span>{t('fieldCron')}</span>
              <input
                value={cron}
                spellCheck={false}
                onChange={e => { onChange({ cron: e.target.value }) }}
              />
              <small>{t('cronHint')}</small>
            </label>
          )}

          {recurring.pattern !== 'custom' && !showAdvancedCron && (
            <button
              type="button"
              className={pickerCss.advancedToggle}
              onClick={() => { setShowAdvancedCron(true) }}
            >
              {t('recurAdvanced')}
            </button>
          )}
        </>
      )}
    </div>
  )
}
