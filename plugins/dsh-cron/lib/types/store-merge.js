/** Three-way record merge used by concurrent cron management processes. */
export function mergeJobs(ours, base, latest, deleted) {
    const merged = [];
    const seen = new Set();
    const byId = new Map(ours.map(record => [record.id, record]));
    for (const [id, current] of latest) {
        if (deleted.has(id))
            continue;
        seen.add(id);
        const our = byId.get(id);
        if (our === undefined || JSON.stringify(our) === base.get(id))
            merged.push(current);
        else
            merged.push(our);
    }
    for (const record of ours) {
        if (seen.has(record.id) || deleted.has(record.id))
            continue;
        if (JSON.stringify(record) !== base.get(record.id))
            merged.push(record);
    }
    return merged;
}
//# sourceMappingURL=store-merge.js.map