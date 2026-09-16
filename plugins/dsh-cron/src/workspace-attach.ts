/**
 * Attach automation-created Sessions to the matching workspace sidebar bucket
 * and give them a readable title (cwd basename fallback looks like "Test env").
 * @module
 */

import { realpathSync, readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { constants, zstdCompressSync, zstdDecompressSync } from 'node:zlib'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import type { CronJob } from './store.ts'

const ZSTD_MAGIC = 4247762216
const ZSTD_CHECKSUM = { params: { [constants.ZSTD_c_checksumFlag]: 1 } } as const

/** Minimal workspaceRegistry surface used by attach. */
export interface WorkspaceRegistryLike {
  readonly list?: () => readonly WorkspaceEntityLike[]
  readonly resolveByPath?: (path: string) => Promise<WorkspaceEntityLike | null | undefined>
  readonly sessionPaths?: { set?: (sessionId: string, cwd: string) => void }
  readonly headers?: { set?: (sessionId: string, header: Record<string, unknown>) => void }
  readonly rememberSessionPath?: (sessionId: string, cwd: string) => void
}

export interface WorkspaceEntityLike {
  readonly id?: string
  readonly workspaceId?: string
  readonly path: string
  readonly title?: string
  readonly sessionIds?: readonly string[]
  attachSession?: (sessionId: string) => Promise<void>
  mutate?: (fn: (record: Record<string, unknown>) => Record<string, unknown>) => Promise<unknown>
}

export interface SessionTitleLike {
  rename?: (session: unknown, title: string) => unknown
}

export interface SessionsLike {
  get?: (id: string) => unknown
}

function normalizePath(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

/** Short sidebar label from the job prompt. */
export function cronSessionTitle(job: CronJob): string {
  const prompt = job.prompt.trim().replace(/\s+/g, ' ')
  if (prompt.length === 0) return `Scheduled ${job.id}`
  if (prompt.length <= 52) return prompt
  return `${prompt.slice(0, 49)}…`
}

async function findWorkspace(
  registry: WorkspaceRegistryLike,
  cwd: string,
): Promise<WorkspaceEntityLike | undefined> {
  const wanted = normalizePath(cwd)
  if (typeof registry.resolveByPath === 'function') {
    try {
      const hit = await registry.resolveByPath(cwd)
      if (hit) return hit
    } catch {
      // fall through to list scan
    }
  }
  const list = typeof registry.list === 'function' ? registry.list() : []
  return list.find(workspace => normalizePath(workspace.path) === wanted)
}

function rememberPath(registry: WorkspaceRegistryLike, sessionId: string, cwd: string): void {
  if (typeof registry.rememberSessionPath === 'function') {
    registry.rememberSessionPath(sessionId, cwd)
    return
  }
  registry.sessionPaths?.set?.(sessionId, cwd)
}

function rememberHeader(
  registry: WorkspaceRegistryLike,
  sessionId: string,
  cwd: string,
  title: string,
): void {
  registry.headers?.set?.(sessionId, { cwd, title })
}

/** Same encoding as dsh-session-persistence-jsonl projectKey. */
function projectKey(cwd: string): string {
  let readable = ''
  let separatorRun = false
  for (let i = 0; i < cwd.length; i++) {
    const ch = cwd[i]!
    if (ch === '/' || ch === '\\' || ch === ':') {
      if (!separatorRun) readable += '-'
      separatorRun = true
    } else if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) {
      readable += ch
      separatorRun = false
    } else {
      readable += `~${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`
      separatorRun = false
    }
  }
  return `--${(readable.replace(/^-+/, '') || 'root').slice(0, 251)}--`
}

function encodeSegment(raw: string): string {
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!
    if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) out += ch
    else out += `~${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`
  }
  return out
}

function scanZstdFrames(buffer: Buffer): Array<{ start: number; end: number }> {
  const frames: Array<{ start: number; end: number }> = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) break
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) break
    offset += 4
    if (offset === buffer.length) break
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    if ((descriptor & 24) !== 0) break
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 32) !== 0
    const checksum = (descriptor & 4) !== 0
    const dictionaryFlag = descriptor & 3
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < remainingHeaderBytes) break
    offset += remainingHeaderBytes
    for (;;) {
      if (buffer.length - offset < 3) return frames
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      const lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 3
      const blockSize = blockHeader >>> 3
      if (blockType === 3) return frames
      const payloadBytes = blockType === 1 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) return frames
      offset += payloadBytes
      if (lastBlock) break
    }
    if (checksum) {
      if (buffer.length - offset < 4) return frames
      offset += 4
    }
    frames.push({ start, end: offset })
  }
  return frames
}

function sessionLogPath(cwd: string, sessionId: string): string | null {
  const root = join(resolveDshHome(), 'sessions', projectKey(cwd), encodeSegment(sessionId))
  for (const name of ['session.v3.jsonl.zstd', 'session.jsonl.zstd', 'session.jsonl'] as const) {
    const path = join(root, name)
    if (existsSync(path)) return path
  }
  return null
}

/** Append a durable session/title event so the sidebar does not fall back to the cwd name. */
export function appendSessionTitleEvent(sessionId: string, cwd: string, title: string): boolean {
  const path = sessionLogPath(cwd, sessionId)
  if (path === null) return false
  try {
    if (path.endsWith('.zstd')) {
      const raw = readFileSync(path)
      let maxSeq = -1
      for (const frame of scanZstdFrames(raw)) {
        const text = zstdDecompressSync(raw.subarray(frame.start, frame.end)).toString('utf8')
        for (const line of text.split('\n')) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line) as { seq?: unknown }
            if (typeof event.seq === 'number' && event.seq > maxSeq) maxSeq = event.seq
          } catch {
            // ignore non-json
          }
        }
      }
      const event = {
        type: 'session/title',
        seq: maxSeq + 1,
        time: Date.now(),
        data: { title, messageSeqs: [] as number[], source: { kind: 'fallback' as const } },
      }
      const frame = zstdCompressSync(Buffer.from(`${JSON.stringify(event)}\n`, 'utf8'), ZSTD_CHECKSUM)
      appendFileSync(path, frame)
      return true
    }
    const text = readFileSync(path, 'utf8')
    let maxSeq = -1
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line) as { seq?: unknown }
        if (typeof event.seq === 'number' && event.seq > maxSeq) maxSeq = event.seq
      } catch {
        // ignore
      }
    }
    const event = {
      type: 'session/title',
      seq: maxSeq + 1,
      time: Date.now(),
      data: { title, messageSeqs: [] as number[], source: { kind: 'fallback' as const } },
    }
    appendFileSync(path, `${JSON.stringify(event)}\n`)
    return true
  } catch {
    return false
  }
}

/** Best-effort durable title write into the projection cache shard. */
export function writeProjcacheTitle(sessionId: string, cwd: string, title: string): void {
  try {
    const root = join(resolveDshHome(), 'storages', 'session_projcache', 'sessions')
    mkdirSync(root, { recursive: true })
    const file = join(root, `${sessionId}.json`)
    let doc: Record<string, unknown>
    if (existsSync(file)) {
      doc = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    } else {
      doc = {
        version: 7,
        record: {
          identity: { formatVersion: 3, createdAt: Date.now(), cwd, isSeeded: false, inheritedEventCount: 0 },
          rows: {},
        },
      }
    }
    const record = (doc.record ?? {}) as Record<string, unknown>
    const identity = (record.identity ?? {}) as Record<string, unknown>
    identity.cwd = cwd
    record.identity = identity
    const rows = (record.rows ?? {}) as Record<string, unknown>
    const prev = (rows.title ?? {}) as Record<string, unknown>
    const nextSeq = (typeof prev.seq === 'number' ? prev.seq : 1) + 1
    rows.title = { ver: typeof prev.ver === 'number' ? prev.ver : 1, seq: nextSeq, val: title }
    record.rows = rows
    doc.record = record
    writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')

    // Promote into the aggregate index when the session is already present there.
    const aggregate = join(resolveDshHome(), 'storages', 'session_projcache.json')
    if (!existsSync(aggregate)) return
    const index = JSON.parse(readFileSync(aggregate, 'utf8')) as {
      tables?: { sessions?: Record<string, Record<string, unknown>> }
    }
    const sessions = index.tables?.sessions
    if (!sessions || !(sessionId in sessions)) return
    const entry = sessions[sessionId] ?? {}
    const entryRows = ((entry as { rows?: Record<string, unknown> }).rows ?? {}) as Record<string, unknown>
    const prevTitle = (entryRows.title ?? {}) as Record<string, unknown>
    entryRows.title = {
      ver: typeof prevTitle.ver === 'number' ? prevTitle.ver : 1,
      seq: (typeof prevTitle.seq === 'number' ? prevTitle.seq : 1) + 1,
      val: title,
    }
    ;(entry as { rows: Record<string, unknown> }).rows = entryRows
    const entryIdentity = ((entry as { identity?: Record<string, unknown> }).identity ?? {}) as Record<string, unknown>
    entryIdentity.cwd = cwd
    ;(entry as { identity: Record<string, unknown> }).identity = entryIdentity
    sessions[sessionId] = entry
    writeFileSync(aggregate, `${JSON.stringify(index, null, 2)}\n`, 'utf8')
  } catch {
    // Title on disk is best-effort; membership is the critical path.
  }
}

function tryLiveRename(
  sessions: SessionsLike | undefined,
  sessionTitle: SessionTitleLike | undefined,
  sessionId: string,
  title: string,
): boolean {
  if (!sessions?.get || !sessionTitle?.rename) return false
  try {
    const live = sessions.get(sessionId)
    if (live === undefined || live === null) return false
    sessionTitle.rename(live, title)
    return true
  } catch {
    return false
  }
}

/**
 * Ensure a cron/automation Session appears under its target workspace in the sidebar.
 */
export async function attachCronSession(options: {
  readonly registry: WorkspaceRegistryLike
  readonly sessionId: string
  readonly cwd: string
  readonly title: string
  readonly warn: (message: string) => void
  readonly sessions?: SessionsLike
  readonly sessionTitle?: SessionTitleLike
}): Promise<boolean> {
  const { registry, sessionId, cwd, title, warn, sessions, sessionTitle } = options
  if (!sessionId || !cwd) return false

  const workspace = await findWorkspace(registry, cwd)
  if (workspace === undefined) {
    warn(`dsh-cron: no workspace registered for ${cwd}; session ${sessionId} stays Ungrouped`)
    rememberPath(registry, sessionId, cwd)
    rememberHeader(registry, sessionId, cwd, title)
    appendSessionTitleEvent(sessionId, cwd, title)
    writeProjcacheTitle(sessionId, cwd, title)
    tryLiveRename(sessions, sessionTitle, sessionId, title)
    return false
  }

  rememberPath(registry, sessionId, cwd)
  rememberHeader(registry, sessionId, cwd, title)

  try {
    if (typeof workspace.attachSession === 'function') {
      await workspace.attachSession(sessionId)
    } else if (typeof workspace.mutate === 'function') {
      await workspace.mutate(record => {
        const ids = Array.isArray(record.sessionIds) ? record.sessionIds as string[] : []
        if (ids.includes(sessionId)) return record
        return { ...record, sessionIds: [sessionId, ...ids] }
      })
    } else {
      warn(`dsh-cron: workspace ${workspace.path} has no attachSession/mutate`)
      return false
    }
  } catch (error) {
    // Stock attachSession validates header cwd; mutate fallback still needs rememberSessionPath.
    try {
      if (typeof workspace.mutate === 'function') {
        await workspace.mutate(record => {
          const ids = Array.isArray(record.sessionIds) ? record.sessionIds as string[] : []
          if (ids.includes(sessionId)) return record
          return { ...record, sessionIds: [sessionId, ...ids] }
        })
        rememberPath(registry, sessionId, cwd)
      } else {
        throw error
      }
    } catch (fallbackError) {
      warn(
        `dsh-cron: attach ${sessionId} → ${workspace.path || basename(cwd)} failed: ${
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        }`,
      )
      return false
    }
  }

  appendSessionTitleEvent(sessionId, cwd, title)
  writeProjcacheTitle(sessionId, cwd, title)
  tryLiveRename(sessions, sessionTitle, sessionId, title)
  return true
}
