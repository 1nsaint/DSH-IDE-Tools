/**
 * Scheduled tasks UI: workbench tab view and shared schedule editor.
 * Polls the host `/cron` channel — no model involvement in the browser.
 * @module
 */
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { CronKey } from './locales.ts';
export type CronTranslator = (key: CronKey, params?: Record<string, string | number>) => string;
export type CronScheduleProps = {
    readonly connection: ConnectionHandle;
    /** 0.1.5+ model catalog (`remote.session.modelCatalog`); optional for older hosts. */
    readonly remote?: {
        readonly session?: {
            readonly modelCatalog?: () => Promise<{
                readonly ok: boolean;
                readonly value?: {
                    readonly groups?: ReadonlyArray<{
                        readonly id: string;
                        readonly name: string;
                        readonly models?: ReadonlyArray<{
                            readonly id: string;
                            readonly name?: string;
                        }>;
                    }>;
                };
                readonly error?: {
                    readonly message?: string;
                };
            }>;
        };
    };
    readonly t: CronTranslator;
    readonly useSessions: PropsRuntime<'sidebar.footer.action'>['useSessions'];
    readonly useWorkspaces: PropsRuntime<'sidebar.footer.action'>['useWorkspaces'];
};
export type CronTabProps = PropsLocale<'sidebar.cron'> & CronScheduleProps & {
    readonly connection: ConnectionHandle;
};
export declare function CronTabView(props: CronTabProps): JSX.Element;
/** Format a wire timestamp in the browser's locale and time zone. */
export declare function formatDateTime(value: string): string;
export declare function CronScheduleView({ connection, t, useSessions, useWorkspaces }: CronScheduleProps): JSX.Element;
//# sourceMappingURL=CronPanel.d.ts.map