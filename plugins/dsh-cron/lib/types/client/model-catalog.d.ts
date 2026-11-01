/**
 * Upgrade-safe model catalog for the cron UI.
 *
 * DSH 0.1.5 removed `connection.api.llm.models` (`/api/llm.models` → 404).
 * Stock catalog is `session/modelCatalog` via the typpert gateway:
 *   POST /api/session/modelCatalog  payload: { args: {} }
 *
 * Prefer the HTTP shape over Cordis `remote.session` inject — hard-injecting
 * `remote` fails with "cannot get property remote.session without inject".
 * @module
 */
type ModelGroup = {
    readonly id: string;
    readonly name: string;
    readonly models?: ReadonlyArray<{
        readonly id: string;
        readonly name?: string;
    }>;
};
/** Returns provider/model groups, or null when the API is unavailable. */
export declare function fetchCronModelGroups(signal?: AbortSignal): Promise<ReadonlyArray<ModelGroup> | null>;
/** @deprecated no-op kept for apply() callers during transition */
export declare function bindCronModelCatalog(_remote: unknown): void;
/** @deprecated no-op kept for apply() callers during transition */
export declare function unbindCronModelCatalog(): void;
export {};
//# sourceMappingURL=model-catalog.d.ts.map