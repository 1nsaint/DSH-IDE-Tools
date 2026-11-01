/**
 * dsh-cron browser half: scheduled tasks in the workbench tab strip.
 * Polls the host `/cron` channel — no model involvement.
 * @module
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type CronKey } from './locales.ts';
/** Namespace owning the cron panel copy; merged into LocaleNamespaceMap. */
export declare const CRON_LOCALE_NS = "sidebar.cron";
export declare const CRON_TAB_LABEL = "Scheduled";
export declare const CRON_HERO_TOOL_ID = "scheduled";
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Cron workbench tab copy. */
        'sidebar.cron': CronKey;
    }
}
declare global {
    interface Window {
        __dshHeroToolRegistry?: {
            _map?: Map<string, () => unknown>;
            register: (id: string, factory: () => unknown) => () => void;
            get: (id: string) => (() => unknown) | undefined;
        };
    }
}
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map