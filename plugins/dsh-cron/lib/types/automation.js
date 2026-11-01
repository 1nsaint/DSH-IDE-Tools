/** Public structural boundary consumed from dsh-automation v0.2. */
export function requireAutomation(value) {
    if (typeof value !== 'object' || value === null)
        throw new Error('dsh-cron: dsh-automation v0.2 service is required');
    const candidate = value;
    for (const method of ['submit', 'get', 'changes', 'checkpointConsumer', 'status']) {
        if (typeof candidate[method] !== 'function')
            throw new Error(`dsh-cron: automation service is missing ${method}()`);
    }
    return value;
}
//# sourceMappingURL=automation.js.map