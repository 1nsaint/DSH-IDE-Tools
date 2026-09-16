import { describe, expect, it } from 'vitest'
import { isValidIanaTimeZone, listIanaTimeZones, resolveTimeZoneChoice } from '../src/client/timezones.ts'

describe('timezones', () => {
  it('lists 24 curated zones', () => {
    const zones = listIanaTimeZones()
    expect(zones).toHaveLength(24)
    expect(zones).toContain('UTC')
    expect(zones).toContain('Europe/Amsterdam')
  })

  it('validates known zones', () => {
    expect(isValidIanaTimeZone('Europe/Amsterdam')).toBe(true)
    expect(isValidIanaTimeZone('Not/A_Zone')).toBe(false)
  })

  it('resolves choice from list', () => {
    const zones = listIanaTimeZones()
    expect(resolveTimeZoneChoice('Europe/Amsterdam', zones)).toBe('Europe/Amsterdam')
    expect(resolveTimeZoneChoice('', zones)).toMatch(/./)
  })
})
