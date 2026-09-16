/**
 * IANA time zone dropdown for scheduled tasks.
 * @module
 */

import { useMemo, type JSX } from 'react'
import pickerCss from './schedule-picker.module.css'
import { listIanaTimeZones, resolveTimeZoneChoice } from './timezones.ts'

export interface TimezoneSelectProps {
  readonly value: string
  readonly label: string
  readonly hint?: string | undefined
  readonly onChange: (timeZone: string) => void
}

export function TimezoneSelect({ value, label, hint, onChange }: TimezoneSelectProps): JSX.Element {
  const zones = useMemo(() => listIanaTimeZones(), [])
  const selected = useMemo(() => resolveTimeZoneChoice(value, zones), [value, zones])
  const showCustom = Boolean(value.trim()) && !zones.includes(value.trim()) && value.trim() !== selected

  return (
    <label className={pickerCss.tzField}>
      <span>{label}</span>
      <select
        className={pickerCss.tzSelect}
        value={showCustom ? value.trim() : selected}
        onChange={e => { onChange(e.target.value) }}
      >
        {showCustom ? (
          <option value={value.trim()}>{value.trim()}</option>
        ) : null}
        {zones.map(zone => (
          <option key={zone} value={zone}>{zone}</option>
        ))}
      </select>
      {hint ? <small>{hint}</small> : null}
    </label>
  )
}
