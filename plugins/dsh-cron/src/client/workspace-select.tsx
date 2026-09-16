/**
 * Workspace picker with sidebar-matching colored folder icons.
 * @module
 */

import { useEffect, useId, useMemo, useRef, useState, type JSX } from 'react'
import { IconChevronDownOutline16, IconFolderFilled16 } from './icons.tsx'
import type { WorkspaceRow } from './runtime-stores.ts'
import {
  subscribeWorkspaceAccent,
  workspaceFolderColor,
} from './workspace-accent-bridge.ts'
import css from './workspace-select.module.css'

export interface WorkspaceSelectProps {
  readonly value: string
  readonly onChange: (path: string) => void
  readonly workspaces: readonly WorkspaceRow[]
  readonly defaultLabel: string
  readonly extraOptions?: ReadonlyArray<{ readonly value: string; readonly label: string }>
}

function workspaceLabel(row: WorkspaceRow): string {
  return String(row.title || row.name || row.path || '').trim() || row.path || ''
}

function folderColorForPath(
  path: string,
  workspaces: readonly WorkspaceRow[],
): string | undefined {
  if (!path) return undefined
  const hit = workspaces.find(w => w.path === path)
  return hit ? workspaceFolderColor(hit) : undefined
}

export function WorkspaceSelect({
  value,
  onChange,
  workspaces,
  defaultLabel,
  extraOptions = [],
}: WorkspaceSelectProps): JSX.Element {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [, setAccentTick] = useState(0)

  useEffect(() => subscribeWorkspaceAccent(() => { setAccentTick(t => t + 1) }), [])

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent): void => {
      const node = rootRef.current
      if (node && event.target instanceof Node && !node.contains(event.target)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const selectedLabel = useMemo(() => {
    if (!value) return defaultLabel
    const hit = workspaces.find(w => w.path === value)
    if (hit) return workspaceLabel(hit)
    const extra = extraOptions.find(o => o.value === value)
    return extra?.label ?? value
  }, [value, workspaces, defaultLabel, extraOptions])

  const triggerFolderColor = useMemo(
    () => folderColorForPath(value, workspaces),
    [value, workspaces],
  )

  const pick = (path: string): void => {
    onChange(path)
    setOpen(false)
  }

  return (
    <div className={css.root} ref={rootRef}>
      <button
        type="button"
        className={css.trigger}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        onClick={() => { setOpen(current => !current) }}
      >
        <IconFolderFilled16
          size={16}
          className={css.folderIcon}
          color={triggerFolderColor ?? 'var(--dsw-alias-label-tertiary)'}
        />
        <span className={css.triggerLabel}>{selectedLabel}</span>
        <IconChevronDownOutline16 size={16} className={css.chevron} />
      </button>
      {open ? (
        <ul id={listId} className={css.menu} role="listbox" aria-label={defaultLabel}>
          <li role="none">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={`${css.option}${!value ? ` ${css.optionActive}` : ''}`}
              onClick={() => { pick('') }}
            >
              <IconFolderFilled16
                size={16}
                className={css.folderIcon}
                color="var(--dsw-alias-label-tertiary)"
              />
              <span className={css.optionLabel}>{defaultLabel}</span>
            </button>
          </li>
          {workspaces.map(workspace => {
            const path = workspace.path ?? ''
            const label = workspaceLabel(workspace)
            const color = workspaceFolderColor(workspace)
            const active = value === path
            return (
              <li key={workspace.workspaceId ?? path} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`${css.option}${active ? ` ${css.optionActive}` : ''}`}
                  onClick={() => { pick(path) }}
                >
                  <IconFolderFilled16
                    size={16}
                    className={css.folderIcon}
                    color={color ?? 'var(--dsw-alias-label-secondary)'}
                  />
                  <span className={css.optionLabel}>{label}</span>
                </button>
              </li>
            )
          })}
          {extraOptions.map(option => {
            const active = value === option.value
            const color = folderColorForPath(option.value, workspaces)
            return (
              <li key={option.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`${css.option}${active ? ` ${css.optionActive}` : ''}`}
                  onClick={() => { pick(option.value) }}
                >
                  <IconFolderFilled16
                    size={16}
                    className={css.folderIcon}
                    color={color ?? 'var(--dsw-alias-label-secondary)'}
                  />
                  <span className={css.optionLabel}>{option.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
