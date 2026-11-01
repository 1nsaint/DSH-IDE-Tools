/**
 * dsh-cron browser half: scheduled tasks in the workbench tab strip.
 * Polls the host `/cron` channel — no model involvement.
 * @module
 */
import { createElement } from 'react';
import { CronTabView } from "./CronPanel.js";
import { en, formatCronMessage, zh } from "./locales.js";
import { bindHarnessRuntimeStores, unbindHarnessRuntimeStores, useCronSessions, useCronWorkspaces, } from "./runtime-stores.js";
/** Namespace owning the cron panel copy; merged into LocaleNamespaceMap. */
export const CRON_LOCALE_NS = 'sidebar.cron';
export const CRON_TAB_LABEL = 'Scheduled';
export const CRON_HERO_TOOL_ID = 'scheduled';
export const inject = ['slots', 'connection', 'locale', 'workspaces', 'sessions'];
const heroSessionsHook = useCronSessions;
const heroWorkspacesHook = useCronWorkspaces;
function ensureHeroRegistry() {
    if (typeof window === 'undefined') {
        return {
            register: () => () => { },
            get: () => undefined,
        };
    }
    if (!window.__dshHeroToolRegistry) {
        const map = new Map();
        window.__dshHeroToolRegistry = {
            _map: map,
            register(id, factory) {
                map.set(id, factory);
                return () => { map.delete(id); };
            },
            get(id) {
                return map.get(id);
            },
        };
    }
    return window.__dshHeroToolRegistry;
}
function heroCronView(connection) {
    const t = (key, params) => formatCronMessage(en, key, params);
    return createElement(CronTabView, {
        connection,
        t,
        useSessions: heroSessionsHook,
        useWorkspaces: heroWorkspacesHook,
    });
}
function bindFromContext(ctx) {
    bindHarnessRuntimeStores({
        workspaces: ctx.get('workspaces'),
        sessions: ctx.get('sessions'),
    });
}
export function apply(ctx) {
    const connection = ctx.get('connection');
    bindFromContext(ctx);
    ctx.effect(() => {
        bindFromContext(ctx);
        return () => { unbindHarnessRuntimeStores(); };
    }, 'dsh-cron: runtime stores');
    ctx.effect(() => ctx.locale.register(CRON_LOCALE_NS, { zh, en }), 'dsh-cron: panel dictionaries');
    ctx.effect(() => ctx.slots.inject('conversation.view', () => ctx.slots.register({
        name: 'conversation.view',
        id: CRON_HERO_TOOL_ID,
        order: 46,
        label: () => CRON_TAB_LABEL,
        locale: CRON_LOCALE_NS,
        inject: () => ({
            connection,
            useSessions: heroSessionsHook,
            useWorkspaces: heroWorkspacesHook,
        }),
    }, CronTabView)), 'dsh-cron: workbench tab');
    ctx.effect(() => {
        const registry = ensureHeroRegistry();
        return registry.register(CRON_HERO_TOOL_ID, () => heroCronView(connection));
    }, 'dsh-cron: hero tool');
}
//# sourceMappingURL=index.js.map