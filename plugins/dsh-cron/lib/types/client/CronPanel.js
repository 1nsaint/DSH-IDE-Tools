import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Scheduled tasks UI: workbench tab view and shared schedule editor.
 * Polls the host `/cron` channel — no model involvement in the browser.
 * @module
 */
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import css from './CronPanel.module.css';
import { IconCheckOutline14, IconChevronDownOutline16, IconClockOutline16, IconListOutline16, IconPauseOutline16, IconPlusOutline16, } from "./icons.js";
import { callRpc } from "./rpc.js";
import { SchedulePicker, combineAtLocal, defaultAtLocal } from "./schedule-picker.js";
import { isMountRootWorkspace } from "./runtime-stores.js";
import { WorkspaceSelect } from "./workspace-select.js";
import { fetchCronModelGroups } from "./model-catalog.js";
import { DEFAULT_STANDING_INSTRUCTIONS } from "../standing.js";
const POLL_MS = 30_000;
const TAB_ORDER = ['create', 'all', 'active', 'paused', 'done'];
function tabIcon(id) {
    switch (id) {
        case 'create':
            return _jsx(IconPlusOutline16, { size: 15, className: css.filterIcon });
        case 'all':
            return _jsx(IconListOutline16, { size: 15, className: css.filterIcon });
        case 'active':
            return _jsx(IconClockOutline16, { size: 15, className: css.filterIcon });
        case 'paused':
            return _jsx(IconPauseOutline16, { size: 15, className: css.filterIcon });
        case 'done':
            return _jsx(IconCheckOutline14, { size: 14, className: css.filterIcon });
    }
}
const MODEL_SEP = '::';
export function CronTabView(props) {
    const { connection, remote, t, useSessions, useWorkspaces } = props;
    return (_jsx("div", { className: css.root, "data-dsh-cron-root": "1", children: _jsx(CronScheduleView, { connection: connection, ...(remote === undefined ? {} : { remote }), t: t, useSessions: useSessions, useWorkspaces: useWorkspaces }) }));
}
function defaultTimeZone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    catch {
        return 'UTC';
    }
}
function initialDraft(cwd = '') {
    return {
        prompt: '',
        kind: 'cron',
        cron: '0 9 * * *',
        timeZone: defaultTimeZone(),
        at: '',
        cwd,
        modelKey: '',
    };
}
function encodeModelKey(provider, model) {
    return `${provider}${MODEL_SEP}${model}`;
}
function decodeModelKey(key) {
    const i = key.indexOf(MODEL_SEP);
    if (i <= 0)
        return null;
    const provider = key.slice(0, i).trim();
    const model = key.slice(i + MODEL_SEP.length).trim();
    if (!provider || !model)
        return null;
    return { provider, model };
}
function pad2(n) {
    return String(n).padStart(2, '0');
}
function isoToLocalAt(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return defaultAtLocal();
    const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    return combineAtLocal(date, d.getHours(), d.getMinutes());
}
function draftFromJob(job, fallbackCwd = '') {
    const cwd = job.target?.cwd ?? fallbackCwd;
    const modelKey = job.target?.provider && job.target?.model
        ? encodeModelKey(job.target.provider, job.target.model)
        : '';
    if (job.schedule.kind === 'cron') {
        return {
            prompt: job.prompt,
            kind: 'cron',
            cron: job.schedule.expression,
            timeZone: job.schedule.timeZone,
            at: '',
            cwd,
            modelKey,
        };
    }
    return {
        prompt: job.prompt,
        kind: 'at',
        cron: '0 9 * * *',
        timeZone: defaultTimeZone(),
        at: isoToLocalAt(job.schedule.at),
        cwd,
        modelKey,
    };
}
/** Format a wire timestamp in the browser's locale and time zone. */
export function formatDateTime(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return value;
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(parsed);
}
function outcomeLabel(run, t) {
    return t(`outcome.${run.outcome ?? run.state}`);
}
function scheduleLabel(job, t) {
    if (job.schedule.kind === 'at')
        return t('scheduleOnce');
    return t('scheduleRecurring', { timeZone: job.schedule.timeZone });
}
function visibleFor(job, filter) {
    if (filter === 'all')
        return true;
    if (filter === 'done')
        return job.state === 'done';
    if (filter === 'paused')
        return job.state === 'active' && job.paused;
    return job.state === 'active' && !job.paused;
}
function createPayload(draft, createdBy) {
    const owner = createdBy === undefined ? {} : { createdBy };
    const cwd = draft.cwd.trim();
    const model = decodeModelKey(draft.modelKey);
    const target = {
        ...(cwd ? { cwd } : {}),
        ...(cwd && model ? { provider: model.provider, model: model.model } : {}),
    };
    if (draft.kind === 'cron') {
        return { prompt: draft.prompt, cron: draft.cron, timeZone: draft.timeZone, ...owner, ...target };
    }
    return { prompt: draft.prompt, at: new Date(draft.at).toISOString(), ...owner, ...target };
}
function createErrorMessage(cause, t) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (message.includes('invalid_prompt:'))
        return t('createErrorPrompt');
    if (message.includes('invalid_cron_expression:'))
        return t('createErrorCron');
    if (message.includes('invalid_time_zone:'))
        return t('createErrorTimeZone');
    if (message.includes('not_future:'))
        return t('createErrorFuture');
    if (message.includes('too_frequent:'))
        return t('createErrorFrequent');
    if (message.includes('too_many_jobs:'))
        return t('createErrorLimit');
    if (message.includes('schedule_unreachable:'))
        return t('createErrorUnreachable');
    if (message.includes('invalid_selector:'))
        return t('createErrorSchedule');
    if (message.includes('invalid_target:'))
        return t('createErrorTarget');
    if (message.includes('payload.cwd'))
        return t('createErrorTarget');
    if (message.includes('not_found:'))
        return t('errorMissing', { id: 'task' });
    return message;
}
export function CronScheduleView({ connection, t, useSessions, useWorkspaces }) {
    const [list, setList] = useState(null);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [filter, setFilter] = useState('create');
    const [draft, setDraft] = useState(() => initialDraft());
    const [editingId, setEditingId] = useState(null);
    const [expanded, setExpanded] = useState(null);
    const [confirmRemove, setConfirmRemove] = useState(null);
    const [busy, setBusy] = useState(null);
    const [standing, setStanding] = useState(DEFAULT_STANDING_INSTRUCTIONS);
    const [standingDirty, setStandingDirty] = useState(false);
    const [modelOptions, setModelOptions] = useState([]);
    const [modelsState, setModelsState] = useState('idle');
    const titleId = useId();
    const currentSession = useSessions(state => state.current);
    const workspaceItems = useWorkspaces(state => state.items ?? []);
    const workspaces = useMemo(() => workspaceItems.filter(item => !isMountRootWorkspace(item.path)), [workspaceItems]);
    const suggestedCwd = useMemo(() => {
        if (currentSession) {
            const owned = workspaces.find(workspace => workspace.sessionIds?.includes(currentSession));
            if (owned?.path)
                return owned.path;
        }
        return workspaces[0]?.path ?? '';
    }, [currentSession, workspaces]);
    const creating = filter === 'create';
    const editing = editingId !== null;
    useEffect(() => {
        if (!creating || editing || (draft.cwd ?? '').trim())
            return;
        if (suggestedCwd)
            setDraft(current => ({ ...current, cwd: suggestedCwd }));
    }, [creating, draft.cwd, editing, suggestedCwd]);
    const resetDraft = useCallback(() => {
        setDraft(initialDraft(suggestedCwd));
        setEditingId(null);
    }, [suggestedCwd]);
    const beginEdit = useCallback((job) => {
        setEditingId(job.id);
        setDraft(draftFromJob(job, suggestedCwd));
        setFilter('create');
        setExpanded(null);
        setConfirmRemove(null);
        setError(null);
        setNotice(null);
    }, [suggestedCwd]);
    const refresh = useCallback(async (signal) => {
        const next = await callRpc(connection, 'list', {}, signal);
        setList(next);
        if (!standingDirty && typeof next.standingInstructions === 'string') {
            setStanding(next.standingInstructions);
        }
        else if (!standingDirty && next.standingInstructions === undefined) {
            setStanding(DEFAULT_STANDING_INSTRUCTIONS);
        }
        setError(null);
    }, [connection, standingDirty]);
    const saveStanding = useCallback(async () => {
        setBusy('standing');
        setError(null);
        setNotice(null);
        try {
            const outcome = await callRpc(connection, 'setStanding', {
                standingInstructions: standing,
            });
            setStanding(outcome.standingInstructions);
            setStandingDirty(false);
            setNotice(t('standingSaved'));
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            setBusy(null);
        }
    }, [connection, standing, t]);
    const loadModels = useCallback(async (signal) => {
        setModelsState('loading');
        try {
            let groups = await fetchCronModelGroups(signal);
            if (signal?.aborted)
                return;
            if (groups === null) {
                setModelsState('error');
                setModelOptions([]);
                return;
            }
            const options = [];
            for (const group of groups) {
                for (const model of group.models ?? []) {
                    options.push({
                        key: encodeModelKey(group.id, model.id),
                        provider: group.id,
                        model: model.id,
                        label: `${group.name} / ${model.name || model.id}`,
                    });
                }
            }
            setModelOptions(options);
            setModelsState('ready');
        }
        catch {
            if (!signal?.aborted) {
                setModelsState('error');
                setModelOptions([]);
            }
        }
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        void refresh(controller.signal).catch(() => {
            if (!controller.signal.aborted)
                setError(t('errorLoad'));
        });
        void loadModels(controller.signal);
        const timer = setInterval(() => {
            void refresh(controller.signal).catch(() => { });
        }, POLL_MS);
        return () => {
            controller.abort();
            clearInterval(timer);
        };
    }, [loadModels, refresh, t]);
    const jobs = list?.jobs ?? [];
    const listFilter = creating ? 'all' : filter;
    const visibleJobs = useMemo(() => jobs.filter(job => visibleFor(job, listFilter)), [listFilter, jobs]);
    const counts = useMemo(() => ({
        all: jobs.length,
        active: jobs.filter(job => job.state === 'active' && !job.paused).length,
        paused: jobs.filter(job => job.state === 'active' && job.paused).length,
        done: jobs.filter(job => job.state === 'done').length,
    }), [jobs]);
    const runAction = async (kind, job) => {
        setBusy(`${kind}:${job.id}`);
        setError(null);
        setNotice(null);
        try {
            if (kind === 'fire') {
                const outcome = await callRpc(connection, 'fire', { id: job.id });
                if (outcome.result !== 'submitted') {
                    throw new Error(outcome.result === 'target_required' ? t('errorNoTarget', { id: job.id }) : t('errorMissing', { id: job.id }));
                }
                setNotice(t('noticeFired', { id: job.id }));
            }
            else if (kind === 'pause') {
                const outcome = await callRpc(connection, 'update', { id: job.id, paused: !job.paused });
                if (!outcome.updated)
                    throw new Error(t('errorUpdate', { id: job.id }));
                setNotice(job.paused ? t('noticeResumed', { id: job.id }) : t('noticePaused', { id: job.id }));
            }
            else {
                const outcome = await callRpc(connection, 'remove', { id: job.id });
                if (!outcome.removed)
                    throw new Error(t('errorMissing', { id: job.id }));
                setConfirmRemove(null);
                setExpanded(null);
                setNotice(t('noticeRemoved', { id: job.id }));
            }
            await refresh();
        }
        catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
        }
        finally {
            setBusy(null);
        }
    };
    const submitForm = async () => {
        if (draft.prompt.trim().length === 0) {
            setError(t('errorPrompt'));
            return;
        }
        if (draft.kind === 'cron' && (draft.cron.trim().length === 0 || draft.timeZone.trim().length === 0)) {
            setError(t('errorSchedule'));
            return;
        }
        if (draft.kind === 'at' && (draft.at.length === 0 || Number.isNaN(new Date(draft.at).getTime()))) {
            setError(t('errorSchedule'));
            return;
        }
        if (draft.modelKey && !draft.cwd.trim()) {
            setError(t('errorWorkspaceForModel'));
            return;
        }
        setBusy(editing ? `edit:${editingId}` : 'create');
        setError(null);
        setNotice(null);
        try {
            if (standingDirty) {
                await callRpc(connection, 'setStanding', {
                    standingInstructions: standing,
                });
                setStandingDirty(false);
            }
            if (editing && editingId) {
                const outcome = await callRpc(connection, 'edit', {
                    id: editingId,
                    ...createPayload(draft, undefined),
                });
                setNotice(t('noticeUpdated', { id: outcome.job.id }));
            }
            else {
                const outcome = await callRpc(connection, 'add', createPayload(draft, currentSession));
                setNotice(outcome.deduplicated ? t('noticeDeduplicated', { id: outcome.job.id }) : t('noticeCreated', { id: outcome.job.id }));
            }
            resetDraft();
            setFilter('all');
            await refresh();
        }
        catch (cause) {
            setError(createErrorMessage(cause, t));
        }
        finally {
            setBusy(null);
        }
    };
    const cancelCreate = () => {
        setFilter('all');
        resetDraft();
        setError(null);
        setNotice(null);
    };
    const selectTab = (next) => {
        setFilter(next);
        if (next === 'create') {
            resetDraft();
        }
        else {
            setDraft(initialDraft(suggestedCwd));
            setEditingId(null);
        }
        setExpanded(null);
        setConfirmRemove(null);
        setError(null);
        setNotice(null);
    };
    return (_jsxs("div", { className: css.rootInner, children: [_jsxs("div", { className: css.bar, children: [_jsx("div", { className: css.filterMode, role: "tablist", "aria-label": t('label'), children: TAB_ORDER.map(id => {
                            const label = id === 'create' && editing ? t('filter.edit') : t(`filter.${id}`);
                            return (_jsxs("button", { type: "button", role: "tab", id: id === filter ? titleId : undefined, className: `${css.filterBtn}${filter === id ? ` ${css.filterBtnActive}` : ''}${id === 'create' ? ` ${css.filterBtnCreate}` : ''}`, "aria-selected": filter === id, "aria-label": id === 'create' ? label : `${label} ${counts[id]}`, title: id === 'create' ? label : `${label} (${counts[id]})`, onClick: () => { selectTab(id); }, children: [tabIcon(id), _jsx("span", { className: css.filterLabel, children: label }), id !== 'create' && (_jsx("span", { className: css.count, children: counts[id] }))] }, id));
                        }) }), _jsx("span", { className: css.meta, children: creating ? (editing ? t('editSubtitle') : t('createSubtitle')) : (_jsxs(_Fragment, { children: [_jsx("span", { className: css.metaPrimary, children: t('headerSummary', { count: visibleJobs.length }) }), _jsx("span", { className: css.metaSep, "aria-hidden": "true", children: " \u00B7 " }), _jsx("span", { className: css.metaHint, children: t('navHint') })] })) })] }), (error !== null || notice !== null) && (_jsx("div", { className: error !== null ? css.error : css.notice, role: error !== null ? 'alert' : 'status', children: error ?? notice })), _jsx("div", { className: `${css.body}${creating ? ` ${css.bodyPad}` : ''}`, children: creating ? (_jsxs("form", { className: `${css.form} ${css.formStack}`, onSubmit: (event) => { event.preventDefault(); void submitForm(); }, children: [_jsx("div", { className: css.formSchedule, children: _jsx(SchedulePicker, { kind: draft.kind, cron: draft.cron, timeZone: draft.timeZone, at: draft.at, t: t, onKindChange: (kind) => {
                                    setDraft((current) => {
                                        if (kind === 'at' && !current.at.trim()) {
                                            return { ...current, kind, at: defaultAtLocal() };
                                        }
                                        return { ...current, kind };
                                    });
                                    setError(null);
                                }, onChange: (patch) => {
                                    setDraft(current => ({ ...current, ...patch }));
                                    setError(null);
                                } }) }), _jsxs("div", { className: css.fieldGrid, children: [_jsxs("label", { className: css.field, children: [_jsx("span", { children: t('fieldWorkspace') }), _jsx(WorkspaceSelect, { value: draft.cwd, defaultLabel: t('workspaceDefault'), workspaces: workspaces, extraOptions: draft.cwd && !workspaces.some(workspace => workspace.path === draft.cwd)
                                                ? [{ value: draft.cwd, label: draft.cwd }]
                                                : [], onChange: path => { setDraft(current => ({ ...current, cwd: path })); setError(null); } }), _jsx("small", { children: t('workspaceHint') })] }), _jsxs("label", { className: css.field, children: [_jsx("span", { children: t('fieldModel') }), _jsxs("select", { value: draft.modelKey, disabled: modelsState === 'loading', onChange: event => { setDraft(current => ({ ...current, modelKey: event.target.value })); setError(null); }, children: [_jsx("option", { value: "", children: t('modelDefault') }), modelOptions.map(option => (_jsx("option", { value: option.key, children: option.label }, option.key)))] }), _jsx("small", { children: modelsState === 'loading' ? t('modelLoading')
                                                : modelsState === 'error' ? t('modelUnavailable')
                                                    : t('modelHint') })] })] }), _jsxs("label", { className: css.field, children: [_jsx("span", { children: t('fieldPrompt') }), _jsx("textarea", { value: draft.prompt, rows: 5, placeholder: t('promptPlaceholder'), onChange: event => { setDraft(current => ({ ...current, prompt: event.target.value })); setError(null); } })] }), _jsxs("label", { className: css.field, children: [_jsx("span", { children: t('fieldStanding') }), _jsx("textarea", { value: standing, rows: 8, onChange: event => {
                                        setStanding(event.target.value);
                                        setStandingDirty(true);
                                        setError(null);
                                    } }), _jsx("small", { children: t('standingHint') })] }), _jsxs("div", { className: css.formActions, children: [_jsx("button", { type: "button", className: css.btn, disabled: busy === 'standing', onClick: () => {
                                        setStanding(DEFAULT_STANDING_INSTRUCTIONS);
                                        setStandingDirty(true);
                                    }, children: t('standingReset') }), _jsx("button", { type: "button", className: css.btn, disabled: busy === 'standing' || !standingDirty, onClick: () => { void saveStanding(); }, children: busy === 'standing' ? t('standingSaving') : t('standingSave') }), _jsx("span", { className: css.spacer }), _jsx("button", { type: "button", className: css.btn, onClick: cancelCreate, children: t('cancel') }), _jsx("button", { type: "submit", className: `${css.btn} ${css.btnPrimary}`, disabled: busy === 'create' || (editingId !== null && busy === `edit:${editingId}`), children: editing
                                        ? (busy === `edit:${editingId}` ? t('saving') : t('save'))
                                        : (busy === 'create' ? t('creating') : t('create')) })] })] })) : list === null ? (_jsx("div", { className: css.empty, children: t('loading') })) : visibleJobs.length === 0 ? (_jsx("div", { className: css.empty, children: listFilter === 'all' ? t('emptyAll') : t('emptyFilter') })) : (_jsx("div", { className: css.jobList, children: visibleJobs.map(job => {
                        const isExpanded = expanded === job.id;
                        const status = job.state === 'done' ? 'done' : job.paused ? 'paused' : 'active';
                        return (_jsxs("article", { className: css.job, children: [_jsxs("button", { type: "button", className: css.jobMain, "aria-expanded": isExpanded, "aria-controls": `cron-details-${job.id}`, onClick: () => { setExpanded(isExpanded ? null : job.id); setConfirmRemove(null); }, children: [_jsx("span", { className: `${css.statusIcon} ${css[status]}`, children: status === 'done' ? _jsx(IconCheckOutline14, { size: 14 }) : status === 'paused' ? _jsx(IconPauseOutline16, { size: 14 }) : _jsx(IconClockOutline16, { size: 14 }) }), _jsxs("span", { className: css.jobText, children: [_jsx("strong", { children: job.prompt }), _jsxs("span", { children: [scheduleLabel(job, t), " \u00B7 ", job.schedule.kind === 'cron' ? job.schedule.expression : formatDateTime(job.schedule.at)] })] }), _jsx("span", { className: `${css.jobNext}${status === 'active' ? '' : ` ${css.statusPill}`}`, children: status === 'active' ? t('nextShort', { at: formatDateTime(job.nextAt) }) : t(`state.${status}`) }), _jsx("span", { className: `${css.disclosure}${isExpanded ? ` ${css.disclosureOpen}` : ''}`, "aria-hidden": "true", children: _jsx(IconChevronDownOutline16, { size: 16 }) })] }), isExpanded && (_jsxs("div", { className: css.details, id: `cron-details-${job.id}`, children: [_jsxs("dl", { children: [_jsxs("div", { children: [_jsx("dt", { children: t('detailId') }), _jsx("dd", { children: _jsx("code", { children: job.id }) })] }), _jsxs("div", { children: [_jsx("dt", { children: t('detailCreated') }), _jsx("dd", { children: formatDateTime(job.createdAt) })] }), _jsxs("div", { children: [_jsx("dt", { children: t('detailFires') }), _jsx("dd", { children: t('firedCount', { count: job.fireCount }) })] }), job.target?.cwd !== undefined && _jsxs("div", { children: [_jsx("dt", { children: t('detailWorkspace') }), _jsx("dd", { children: _jsx("code", { children: job.target.cwd }) })] }), job.target?.model !== undefined && (_jsxs("div", { children: [_jsx("dt", { children: t('detailModel') }), _jsx("dd", { children: _jsx("code", { children: job.target.provider ? `${job.target.provider} / ${job.target.model}` : job.target.model }) })] })), job.lastRun !== null && _jsxs("div", { children: [_jsx("dt", { children: t('detailLastRun') }), _jsxs("dd", { children: [outcomeLabel(job.lastRun, t), " \u00B7 ", formatDateTime(job.lastRun.firedAt)] })] })] }), job.lastRun?.excerpt !== undefined && _jsx("div", { className: css.excerpt, children: job.lastRun.excerpt }), _jsxs("div", { className: css.jobActions, children: [job.state === 'active' && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: css.btn, disabled: busy !== null, onClick: () => { beginEdit(job); }, children: t('edit') }), _jsx("button", { type: "button", className: css.btn, disabled: busy !== null, onClick: () => { void runAction('fire', job); }, children: t('runNow') }), _jsx("button", { type: "button", className: css.btn, disabled: busy !== null, onClick: () => { void runAction('pause', job); }, children: job.paused ? t('resume') : t('pause') })] })), confirmRemove === job.id ? (_jsxs("span", { className: css.confirm, children: [_jsx("span", { children: t('confirmRemove') }), _jsx("button", { type: "button", className: css.linkButton, onClick: () => { setConfirmRemove(null); }, children: t('cancel') }), _jsx("button", { type: "button", className: `${css.btn} ${css.btnDanger}`, disabled: busy !== null, onClick: () => { void runAction('remove', job); }, children: t('confirm') })] })) : (_jsx("button", { type: "button", className: css.dangerLink, onClick: () => { setConfirmRemove(job.id); }, children: t('remove') }))] })] }))] }, job.id));
                    }) })) })] }));
}
//# sourceMappingURL=CronPanel.js.map