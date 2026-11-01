/** Three-way record merge used by concurrent cron management processes. */
export declare function mergeJobs<T extends {
    id: string;
}>(ours: readonly T[], base: ReadonlyMap<string, string>, latest: ReadonlyMap<string, T>, deleted: ReadonlySet<string>): T[];
//# sourceMappingURL=store-merge.d.ts.map