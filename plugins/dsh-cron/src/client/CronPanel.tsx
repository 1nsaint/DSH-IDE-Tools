/**
 * Scheduled tasks UI: workbench tab view and shared schedule editor.
 * Polls the host `/cron` channel — no model involvement in the browser.
 * @module
 */

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './CronPanel.module.css'
import {
  IconCheckOutline14,
  IconChevronDownOutline16,
  IconClockOutline16,
  IconListOutline16,
  IconPauseOutline16,
  IconPlusOutline16,
} from './icons.tsx'
import { callRpc } from './rpc.ts'
import type { CronAddWire, CronEditWire, CronFireWire, CronJobWire, CronListWire, CronRemoveWire, CronStandingWire, CronUpdateWire } from './wire.ts'
import type { CronKey } from './locales.ts'
import { SchedulePicker, combineAtLocal, defaultAtLocal } from './schedule-picker.tsx'
import { isMountRootWorkspace } from './runtime-stores.ts'
import { WorkspaceSelect } from './workspace-select.tsx'
import { fetchCronModelGroups } from './model-catalog.ts'
import { DEFAULT_STANDING_INSTRUCTIONS } from '../standing.ts'

const POLL_MS = 30_000

type Filter = 'all' | 'active' | 'paused' | 'done'
type TabId = 'create' | Filter

const TAB_ORDER: readonly TabId[] = ['create', 'all', 'active', 'paused', 'done']

function tabIcon(id: TabId): ReactNode {
  switch (id) {
    case 'create':
      return <IconPlusOutline16 size={15} className={css.filterIcon} />
    case 'all':
      return <IconListOutline16 size={15} className={css.filterIcon} />
    case 'active':
      return <IconClockOutline16 size={15} className={css.filterIcon} />
    case 'paused':
      return <IconPauseOutline16 size={15} className={css.filterIcon} />
    case 'done':
      return <IconCheckOutline14 size={14} className={css.filterIcon} />
  }
}
type ScheduleKind = 'cron' | 'at'

interface ModelOption {
  readonly key: string
  readonly provider: string
  readonly model: string
  readonly label: string
}

interface Draft {
  prompt: string
  kind: ScheduleKind
  cron: string
  timeZone: string
  at: string
  /** Absolute workspace path; empty = profile defaultCwd. */
  cwd: string
  /** `provider::model` or empty for host default. */
  modelKey: string
}

const MODEL_SEP = '::'

export type CronTranslator = (key: CronKey, params?: Record<string, string | number>) => string

export type CronScheduleProps = {
  readonly connection: ConnectionHandle
  /** 0.1.5+ model catalog (`remote.session.modelCatalog`); optional for older hosts. */
  readonly remote?: {
    readonly session?: {
      readonly modelCatalog?: () => Promise<{
        readonly ok: boolean
        readonly value?: {
          readonly groups?: ReadonlyArray<{
            readonly id: string
            readonly name: string
            readonly models?: ReadonlyArray<{ readonly id: string; readonly name?: string }>
          }>
        }
        readonly error?: { readonly message?: string }
      }>
    }
  }
  readonly t: CronTranslator
  readonly useSessions: PropsRuntime<'sidebar.footer.action'>['useSessions']
  readonly useWorkspaces: PropsRuntime<'sidebar.footer.action'>['useWorkspaces']
}

export type CronTabProps = PropsLocale<'sidebar.cron'> & CronScheduleProps & {
  readonly connection: ConnectionHandle
}

export function CronTabView(props: CronTabProps): JSX.Element {
  const { connection, remote, t, useSessions, useWorkspaces } = props
  return (
    <div className={css.root} data-dsh-cron-root="1">
      <CronScheduleView
        connection={connection}
        {...(remote === undefined ? {} : { remote })}
        t={t}
        useSessions={useSessions}
        useWorkspaces={useWorkspaces}
      />
    </div>
  )
}

function defaultTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

function initialDraft(cwd = ''): Draft {
  return {
    prompt: '',
    kind: 'cron',
    cron: '0 9 * * *',
    timeZone: defaultTimeZone(),
    at: '',
    cwd,
    modelKey: '',
  }
}

function encodeModelKey(provider: string, model: string): string {
  return `${provider}${MODEL_SEP}${model}`
}

function decodeModelKey(key: string): { provider: string; model: string } | null {
  const i = key.indexOf(MODEL_SEP)
  if (i <= 0) return null
  const provider = key.slice(0, i).trim()
  const model = key.slice(i + MODEL_SEP.length).trim()
  if (!provider || !model) return null
  return { provider, model }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function isoToLocalAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return defaultAtLocal()
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  return combineAtLocal(date, d.getHours(), d.getMinutes())
}

function draftFromJob(job: CronJobWire, fallbackCwd = ''): Draft {
  const cwd = job.target?.cwd ?? fallbackCwd
  const modelKey = job.target?.provider && job.target?.model
    ? encodeModelKey(job.target.provider, job.target.model)
    : ''
  if (job.schedule.kind === 'cron') {
    return {
      prompt: job.prompt,
      kind: 'cron',
      cron: job.schedule.expression,
      timeZone: job.schedule.timeZone,
      at: '',
      cwd,
      modelKey,
    }
  }
  return {
    prompt: job.prompt,
    kind: 'at',
    cron: '0 9 * * *',
    timeZone: defaultTimeZone(),
    at: isoToLocalAt(job.schedule.at),
    cwd,
    modelKey,
  }
}

/** Format a wire timestamp in the browser's locale and time zone. */
export function formatDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

function outcomeLabel(run: NonNullable<CronJobWire['lastRun']>, t: CronTranslator): string {
  return t(`outcome.${run.outcome ?? run.state}`)
}

function scheduleLabel(job: CronJobWire, t: CronTranslator): string {
  if (job.schedule.kind === 'at') return t('scheduleOnce')
  return t('scheduleRecurring', { timeZone: job.schedule.timeZone })
}

function visibleFor(job: CronJobWire, filter: Filter): boolean {
  if (filter === 'all') return true
  if (filter === 'done') return job.state === 'done'
  if (filter === 'paused') return job.state === 'active' && job.paused
  return job.state === 'active' && !job.paused
}

function createPayload(draft: Draft, createdBy: string | undefined): {
  prompt: string
  cron?: string
  timeZone?: string
  at?: string
  createdBy?: string
  cwd?: string
  provider?: string
  model?: string
} {
  const owner = createdBy === undefined ? {} : { createdBy }
  const cwd = draft.cwd.trim()
  const model = decodeModelKey(draft.modelKey)
  const target = {
    ...(cwd ? { cwd } : {}),
    ...(cwd && model ? { provider: model.provider, model: model.model } : {}),
  }
  if (draft.kind === 'cron') {
    return { prompt: draft.prompt, cron: draft.cron, timeZone: draft.timeZone, ...owner, ...target }
  }
  return { prompt: draft.prompt, at: new Date(draft.at).toISOString(), ...owner, ...target }
}

function createErrorMessage(cause: unknown, t: CronTranslator): string {
  const message = cause instanceof Error ? cause.message : String(cause)
  if (message.includes('invalid_prompt:')) return t('createErrorPrompt')
  if (message.includes('invalid_cron_expression:')) return t('createErrorCron')
  if (message.includes('invalid_time_zone:')) return t('createErrorTimeZone')
  if (message.includes('not_future:')) return t('createErrorFuture')
  if (message.includes('too_frequent:')) return t('createErrorFrequent')
  if (message.includes('too_many_jobs:')) return t('createErrorLimit')
  if (message.includes('schedule_unreachable:')) return t('createErrorUnreachable')
  if (message.includes('invalid_selector:')) return t('createErrorSchedule')
  if (message.includes('invalid_target:')) return t('createErrorTarget')
  if (message.includes('payload.cwd')) return t('createErrorTarget')
  if (message.includes('not_found:')) return t('errorMissing', { id: 'task' })
  return message
}

export function CronScheduleView({ connection, t, useSessions, useWorkspaces }: CronScheduleProps): JSX.Element {
  const [list, setList] = useState<CronListWire | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [filter, setFilter] = useState<TabId>('create')
  const [draft, setDraft] = useState<Draft>(() => initialDraft())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [standing, setStanding] = useState(DEFAULT_STANDING_INSTRUCTIONS)
  const [standingDirty, setStandingDirty] = useState(false)
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
  const [modelsState, setModelsState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const titleId = useId()
  const currentSession = useSessions(state => state.current)
  const workspaceItems = useWorkspaces(state => state.items ?? [])
  const workspaces = useMemo(
    () => workspaceItems.filter(item => !isMountRootWorkspace(item.path)),
    [workspaceItems],
  )

  const suggestedCwd = useMemo(() => {
    if (currentSession) {
      const owned = workspaces.find(workspace => workspace.sessionIds?.includes(currentSession as never))
      if (owned?.path) return owned.path
    }
    return workspaces[0]?.path ?? ''
  }, [currentSession, workspaces])

  const creating = filter === 'create'
  const editing = editingId !== null

  useEffect(() => {
    if (!creating || editing || (draft.cwd ?? '').trim()) return
    if (suggestedCwd) setDraft(current => ({ ...current, cwd: suggestedCwd }))
  }, [creating, draft.cwd, editing, suggestedCwd])

  const resetDraft = useCallback((): void => {
    setDraft(initialDraft(suggestedCwd))
    setEditingId(null)
  }, [suggestedCwd])

  const beginEdit = useCallback((job: CronJobWire): void => {
    setEditingId(job.id)
    setDraft(draftFromJob(job, suggestedCwd))
    setFilter('create')
    setExpanded(null)
    setConfirmRemove(null)
    setError(null)
    setNotice(null)
  }, [suggestedCwd])

  const refresh = useCallback(async (signal?: AbortSignal): Promise<void> => {
    const next = await callRpc<CronListWire>(connection, 'list', {}, signal)
    setList(next)
    if (!standingDirty && typeof next.standingInstructions === 'string') {
      setStanding(next.standingInstructions)
    } else if (!standingDirty && next.standingInstructions === undefined) {
      setStanding(DEFAULT_STANDING_INSTRUCTIONS)
    }
    setError(null)
  }, [connection, standingDirty])

  const saveStanding = useCallback(async (): Promise<void> => {
    setBusy('standing')
    setError(null)
    setNotice(null)
    try {
      const outcome = await callRpc<CronStandingWire>(connection, 'setStanding', {
        standingInstructions: standing,
      })
      setStanding(outcome.standingInstructions)
      setStandingDirty(false)
      setNotice(t('standingSaved'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(null)
    }
  }, [connection, standing, t])

  const loadModels = useCallback(async (signal?: AbortSignal): Promise<void> => {
    setModelsState('loading')
    try {
      let groups = await fetchCronModelGroups(signal)
      if (signal?.aborted) return
      if (groups === null) {
        setModelsState('error')
        setModelOptions([])
        return
      }
      const options: ModelOption[] = []
      for (const group of groups) {
        for (const model of group.models ?? []) {
          options.push({
            key: encodeModelKey(group.id, model.id),
            provider: group.id,
            model: model.id,
            label: `${group.name} / ${model.name || model.id}`,
          })
        }
      }
      setModelOptions(options)
      setModelsState('ready')
    } catch {
      if (!signal?.aborted) {
        setModelsState('error')
        setModelOptions([])
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal).catch(() => {
      if (!controller.signal.aborted) setError(t('errorLoad'))
    })
    void loadModels(controller.signal)
    const timer = setInterval(() => {
      void refresh(controller.signal).catch(() => {})
    }, POLL_MS)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [loadModels, refresh, t])

  const jobs = list?.jobs ?? []
  const listFilter: Filter = creating ? 'all' : filter
  const visibleJobs = useMemo(() => jobs.filter(job => visibleFor(job, listFilter)), [listFilter, jobs])
  const counts = useMemo(() => ({
    all: jobs.length,
    active: jobs.filter(job => job.state === 'active' && !job.paused).length,
    paused: jobs.filter(job => job.state === 'active' && job.paused).length,
    done: jobs.filter(job => job.state === 'done').length,
  }), [jobs])

  const runAction = async (kind: 'fire' | 'pause' | 'remove', job: CronJobWire): Promise<void> => {
    setBusy(`${kind}:${job.id}`)
    setError(null)
    setNotice(null)
    try {
      if (kind === 'fire') {
        const outcome = await callRpc<CronFireWire>(connection, 'fire', { id: job.id })
        if (outcome.result !== 'submitted') {
          throw new Error(outcome.result === 'target_required' ? t('errorNoTarget', { id: job.id }) : t('errorMissing', { id: job.id }))
        }
        setNotice(t('noticeFired', { id: job.id }))
      } else if (kind === 'pause') {
        const outcome = await callRpc<CronUpdateWire>(connection, 'update', { id: job.id, paused: !job.paused })
        if (!outcome.updated) throw new Error(t('errorUpdate', { id: job.id }))
        setNotice(job.paused ? t('noticeResumed', { id: job.id }) : t('noticePaused', { id: job.id }))
      } else {
        const outcome = await callRpc<CronRemoveWire>(connection, 'remove', { id: job.id })
        if (!outcome.removed) throw new Error(t('errorMissing', { id: job.id }))
        setConfirmRemove(null)
        setExpanded(null)
        setNotice(t('noticeRemoved', { id: job.id }))
      }
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(null)
    }
  }

  const submitForm = async (): Promise<void> => {
    if (draft.prompt.trim().length === 0) {
      setError(t('errorPrompt'))
      return
    }
    if (draft.kind === 'cron' && (draft.cron.trim().length === 0 || draft.timeZone.trim().length === 0)) {
      setError(t('errorSchedule'))
      return
    }
    if (draft.kind === 'at' && (draft.at.length === 0 || Number.isNaN(new Date(draft.at).getTime()))) {
      setError(t('errorSchedule'))
      return
    }
    if (draft.modelKey && !draft.cwd.trim()) {
      setError(t('errorWorkspaceForModel'))
      return
    }
    setBusy(editing ? `edit:${editingId}` : 'create')
    setError(null)
    setNotice(null)
    try {
      if (standingDirty) {
        await callRpc<CronStandingWire>(connection, 'setStanding', {
          standingInstructions: standing,
        })
        setStandingDirty(false)
      }
      if (editing && editingId) {
        const outcome = await callRpc<CronEditWire>(connection, 'edit', {
          id: editingId,
          ...createPayload(draft, undefined),
        })
        setNotice(t('noticeUpdated', { id: outcome.job.id }))
      } else {
        const outcome = await callRpc<CronAddWire>(connection, 'add', createPayload(draft, currentSession))
        setNotice(outcome.deduplicated ? t('noticeDeduplicated', { id: outcome.job.id }) : t('noticeCreated', { id: outcome.job.id }))
      }
      resetDraft()
      setFilter('all')
      await refresh()
    } catch (cause) {
      setError(createErrorMessage(cause, t))
    } finally {
      setBusy(null)
    }
  }

  const cancelCreate = (): void => {
    setFilter('all')
    resetDraft()
    setError(null)
    setNotice(null)
  }

  const selectTab = (next: TabId): void => {
    setFilter(next)
    if (next === 'create') {
      resetDraft()
    } else {
      setDraft(initialDraft(suggestedCwd))
      setEditingId(null)
    }
    setExpanded(null)
    setConfirmRemove(null)
    setError(null)
    setNotice(null)
  }

  return (
    <div className={css.rootInner}>
      <div className={css.bar}>
        <div className={css.filterMode} role="tablist" aria-label={t('label')}>
          {TAB_ORDER.map(id => {
            const label = id === 'create' && editing ? t('filter.edit') : t(`filter.${id}`)
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={id === filter ? titleId : undefined}
                className={`${css.filterBtn}${filter === id ? ` ${css.filterBtnActive}` : ''}${id === 'create' ? ` ${css.filterBtnCreate}` : ''}`}
                aria-selected={filter === id}
                aria-label={id === 'create' ? label : `${label} ${counts[id]}`}
                title={id === 'create' ? label : `${label} (${counts[id]})`}
                onClick={() => { selectTab(id) }}
              >
                {tabIcon(id)}
                <span className={css.filterLabel}>{label}</span>
                {id !== 'create' && (
                  <span className={css.count}>{counts[id]}</span>
                )}
              </button>
            )
          })}
        </div>
        <span className={css.meta}>
          {creating ? (
            editing ? t('editSubtitle') : t('createSubtitle')
          ) : (
            <>
              <span className={css.metaPrimary}>{t('headerSummary', { count: visibleJobs.length })}</span>
              <span className={css.metaSep} aria-hidden="true"> · </span>
              <span className={css.metaHint}>{t('navHint')}</span>
            </>
          )}
        </span>
      </div>
      {(error !== null || notice !== null) && (
        <div className={error !== null ? css.error : css.notice} role={error !== null ? 'alert' : 'status'}>
          {error ?? notice}
        </div>
      )}
      <div className={`${css.body}${creating ? ` ${css.bodyPad}` : ''}`}>
        {creating ? (
          <form className={`${css.form} ${css.formStack}`} onSubmit={(event) => { event.preventDefault(); void submitForm() }}>
            <div className={css.formSchedule}>
              <SchedulePicker
                kind={draft.kind}
                cron={draft.cron}
                timeZone={draft.timeZone}
                at={draft.at}
                t={t}
                onKindChange={(kind) => {
                  setDraft((current) => {
                    if (kind === 'at' && !current.at.trim()) {
                      return { ...current, kind, at: defaultAtLocal() }
                    }
                    return { ...current, kind }
                  })
                  setError(null)
                }}
                onChange={(patch) => {
                  setDraft(current => ({ ...current, ...patch }))
                  setError(null)
                }}
              />
            </div>
            <div className={css.fieldGrid}>
              <label className={css.field}>
                <span>{t('fieldWorkspace')}</span>
                <WorkspaceSelect
                  value={draft.cwd}
                  defaultLabel={t('workspaceDefault')}
                  workspaces={workspaces}
                  extraOptions={
                    draft.cwd && !workspaces.some(workspace => workspace.path === draft.cwd)
                      ? [{ value: draft.cwd, label: draft.cwd }]
                      : []
                  }
                  onChange={path => { setDraft(current => ({ ...current, cwd: path })); setError(null) }}
                />
                <small>{t('workspaceHint')}</small>
              </label>
              <label className={css.field}>
                <span>{t('fieldModel')}</span>
                <select
                  value={draft.modelKey}
                  disabled={modelsState === 'loading'}
                  onChange={event => { setDraft(current => ({ ...current, modelKey: event.target.value })); setError(null) }}
                >
                  <option value="">{t('modelDefault')}</option>
                  {modelOptions.map(option => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
                <small>
                  {modelsState === 'loading' ? t('modelLoading')
                    : modelsState === 'error' ? t('modelUnavailable')
                      : t('modelHint')}
                </small>
              </label>
            </div>
            <label className={css.field}>
              <span>{t('fieldPrompt')}</span>
              <textarea
                value={draft.prompt}
                rows={5}
                placeholder={t('promptPlaceholder')}
                onChange={event => { setDraft(current => ({ ...current, prompt: event.target.value })); setError(null) }}
              />
            </label>
            <label className={css.field}>
              <span>{t('fieldStanding')}</span>
              <textarea
                value={standing}
                rows={8}
                onChange={event => {
                  setStanding(event.target.value)
                  setStandingDirty(true)
                  setError(null)
                }}
              />
              <small>{t('standingHint')}</small>
            </label>
            <div className={css.formActions}>
              <button
                type="button"
                className={css.btn}
                disabled={busy === 'standing'}
                onClick={() => {
                  setStanding(DEFAULT_STANDING_INSTRUCTIONS)
                  setStandingDirty(true)
                }}
              >
                {t('standingReset')}
              </button>
              <button
                type="button"
                className={css.btn}
                disabled={busy === 'standing' || !standingDirty}
                onClick={() => { void saveStanding() }}
              >
                {busy === 'standing' ? t('standingSaving') : t('standingSave')}
              </button>
              <span className={css.spacer} />
              <button type="button" className={css.btn} onClick={cancelCreate}>{t('cancel')}</button>
              <button
                type="submit"
                className={`${css.btn} ${css.btnPrimary}`}
                disabled={busy === 'create' || (editingId !== null && busy === `edit:${editingId}`)}
              >
                {editing
                  ? (busy === `edit:${editingId}` ? t('saving') : t('save'))
                  : (busy === 'create' ? t('creating') : t('create'))}
              </button>
            </div>
          </form>
                ) : list === null ? (
                  <div className={css.empty}>{t('loading')}</div>
                ) : visibleJobs.length === 0 ? (
                  <div className={css.empty}>
                    {listFilter === 'all' ? t('emptyAll') : t('emptyFilter')}
                  </div>
                ) : (
                  <div className={css.jobList}>
                    {visibleJobs.map(job => {
                      const isExpanded = expanded === job.id
                      const status = job.state === 'done' ? 'done' : job.paused ? 'paused' : 'active'
                      return (
                        <article key={job.id} className={css.job}>
                          <button
                            type="button"
                            className={css.jobMain}
                            aria-expanded={isExpanded}
                            aria-controls={`cron-details-${job.id}`}
                            onClick={() => { setExpanded(isExpanded ? null : job.id); setConfirmRemove(null) }}
                          >
                            <span className={`${css.statusIcon} ${css[status]}`}>
                              {status === 'done' ? <IconCheckOutline14 size={14} /> : status === 'paused' ? <IconPauseOutline16 size={14} /> : <IconClockOutline16 size={14} />}
                            </span>
                            <span className={css.jobText}>
                              <strong>{job.prompt}</strong>
                              <span>{scheduleLabel(job, t)} · {job.schedule.kind === 'cron' ? job.schedule.expression : formatDateTime(job.schedule.at)}</span>
                            </span>
                            <span className={`${css.jobNext}${status === 'active' ? '' : ` ${css.statusPill}`}`}>
                              {status === 'active' ? t('nextShort', { at: formatDateTime(job.nextAt) }) : t(`state.${status}`)}
                            </span>
                            <span className={`${css.disclosure}${isExpanded ? ` ${css.disclosureOpen}` : ''}`} aria-hidden="true">
                              <IconChevronDownOutline16 size={16} />
                            </span>
                          </button>
                          {isExpanded && (
                            <div className={css.details} id={`cron-details-${job.id}`}>
                              <dl>
                                <div><dt>{t('detailId')}</dt><dd><code>{job.id}</code></dd></div>
                                <div><dt>{t('detailCreated')}</dt><dd>{formatDateTime(job.createdAt)}</dd></div>
                                <div><dt>{t('detailFires')}</dt><dd>{t('firedCount', { count: job.fireCount })}</dd></div>
                                {job.target?.cwd !== undefined && <div><dt>{t('detailWorkspace')}</dt><dd><code>{job.target.cwd}</code></dd></div>}
                                {job.target?.model !== undefined && (
                                  <div>
                                    <dt>{t('detailModel')}</dt>
                                    <dd><code>{job.target.provider ? `${job.target.provider} / ${job.target.model}` : job.target.model}</code></dd>
                                  </div>
                                )}
                                {job.lastRun !== null && <div><dt>{t('detailLastRun')}</dt><dd>{outcomeLabel(job.lastRun, t)} · {formatDateTime(job.lastRun.firedAt)}</dd></div>}
                              </dl>
                              {job.lastRun?.excerpt !== undefined && <div className={css.excerpt}>{job.lastRun.excerpt}</div>}
                              <div className={css.jobActions}>
                                {job.state === 'active' && (
                                  <>
                                    <button type="button" className={css.btn} disabled={busy !== null} onClick={() => { beginEdit(job) }}>{t('edit')}</button>
                                    <button type="button" className={css.btn} disabled={busy !== null} onClick={() => { void runAction('fire', job) }}>{t('runNow')}</button>
                                    <button type="button" className={css.btn} disabled={busy !== null} onClick={() => { void runAction('pause', job) }}>{job.paused ? t('resume') : t('pause')}</button>
                                  </>
                                )}
                                {confirmRemove === job.id ? (
                                  <span className={css.confirm}>
                                    <span>{t('confirmRemove')}</span>
                                    <button type="button" className={css.linkButton} onClick={() => { setConfirmRemove(null) }}>{t('cancel')}</button>
                                    <button type="button" className={`${css.btn} ${css.btnDanger}`} disabled={busy !== null} onClick={() => { void runAction('remove', job) }}>{t('confirm')}</button>
                                  </span>
                                ) : (
                                  <button type="button" className={css.dangerLink} onClick={() => { setConfirmRemove(job.id) }}>{t('remove')}</button>
                                )}
                              </div>
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                )}
      </div>
    </div>
  )
}
