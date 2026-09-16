/**
 * Curated IANA time zones for the schedule picker (24 common choices).
 * @module
 */

const ZONES_24: readonly string[] = [
  'UTC',
  'Europe/London',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Rome',
  'Europe/Stockholm',
  'Europe/Athens',
  'Europe/Istanbul',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
]

export function listIanaTimeZones(): readonly string[] {
  return ZONES_24
}

export function isValidIanaTimeZone(timeZone: string): boolean {
  if (!timeZone.trim()) return false
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timeZone.trim() })
    return true
  } catch {
    return false
  }
}

/** Pick a value that works in the zone list (keeps custom valid zones as extra option). */
export function resolveTimeZoneChoice(value: string, zones: readonly string[]): string {
  const trimmed = value.trim()
  if (trimmed && zones.includes(trimmed)) return trimmed
  if (trimmed && isValidIanaTimeZone(trimmed)) return trimmed
  const local = typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : ''
  if (local && zones.includes(local)) return local
  if (local && isValidIanaTimeZone(local)) return local
  return 'UTC'
}
