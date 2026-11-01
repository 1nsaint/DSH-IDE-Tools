/** Durable, transport-safe automation domain types. */
import { isAbsolute } from 'node:path';
/** Validate runtime settlement payloads before they cross the durable boundary. */
export function resolveSettlement(settlement) {
    const allowed = {
        succeeded: ['completed'],
        failed: ['blocked', 'max-tokens', 'error', 'not-dispatched'],
        cancelled: ['aborted', 'cancelled'],
        indeterminate: ['interrupted'],
    };
    if (!Object.hasOwn(allowed, settlement.state) || !allowed[settlement.state].includes(settlement.outcome)) {
        invalid(`outcome ${String(settlement.outcome)} is invalid for settlement state ${String(settlement.state)}`);
    }
    optionalBoundedText(settlement.resultExcerpt, 'result excerpt', 2_000);
    optionalBoundedText(settlement.error, 'settlement error', 4_000);
    return settlement;
}
/** Stable coded failure from a domain or persistence precondition. */
export class AutomationError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'AutomationError';
    }
}
/** Validate and normalize one submission at the durable boundary. */
export function resolveSubmitRequest(request, now) {
    if (!Number.isSafeInteger(now) || now < 0)
        invalid('now must be a non-negative safe integer');
    const prompt = request.prompt.trim();
    if (prompt === '')
        invalid('prompt must not be empty');
    if (prompt.length > 1_000_000)
        invalid('prompt must not exceed 1000000 characters');
    if (request.target.kind !== 'fresh')
        invalid('target kind must be fresh');
    if (!isAbsolute(request.target.cwd))
        invalid('fresh target cwd must be an absolute path');
    if (request.target.cwd.length > 4_096)
        invalid('fresh target cwd must not exceed 4096 characters');
    optionalBoundedText(request.target.preset, 'target preset', 256);
    optionalBoundedText(request.target.provider, 'target provider', 256);
    optionalBoundedText(request.target.model, 'target model', 512);
    if ((request.target.provider === undefined) !== (request.target.model === undefined)) {
        invalid('target provider and model must be supplied together');
    }
    optionalBoundedText(request.target.permissionPreset, 'target permission preset', 256);
    triggerKind(request.trigger.kind);
    boundedText(request.trigger.sourceId, 'trigger sourceId', 256);
    optionalBoundedText(request.trigger.occurrenceId, 'trigger occurrenceId', 512);
    optionalBoundedText(request.trigger.idempotencyKey, 'trigger idempotencyKey', 512);
    if (request.concurrency !== undefined) {
        boundedText(request.concurrency.key, 'concurrency key', 256);
        if (!Number.isSafeInteger(request.concurrency.limit) || request.concurrency.limit < 1 || request.concurrency.limit > 1_000) {
            invalid('concurrency limit must be an integer between 1 and 1000');
        }
    }
    const priority = request.priority ?? 0;
    if (!Number.isSafeInteger(priority))
        invalid('priority must be a safe integer');
    const availableAt = request.availableAt ?? now;
    if (!Number.isSafeInteger(availableAt) || availableAt < 0)
        invalid('availableAt must be a non-negative safe integer');
    const maxAttempts = request.maxAttempts ?? 1;
    if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1)
        invalid('maxAttempts must be a positive safe integer');
    return { ...request, prompt, priority, availableAt, maxAttempts };
}
/** Parse and validate persisted Trigger JSON. */
export function decodeTrigger(value) {
    const record = plainRecord(value, 'trigger');
    exactKeys(record, ['kind', 'sourceId'], ['occurrenceId', 'idempotencyKey'], 'trigger');
    if (typeof record['kind'] !== 'string' || typeof record['sourceId'] !== 'string') {
        invalid('persisted trigger is invalid');
    }
    triggerKind(record['kind']);
    boundedText(record['sourceId'], 'trigger sourceId', 256);
    const occurrenceId = optionalBoundedString(record['occurrenceId'], 'trigger occurrenceId', 512);
    const idempotencyKey = optionalBoundedString(record['idempotencyKey'], 'trigger idempotencyKey', 512);
    return {
        kind: record['kind'],
        sourceId: record['sourceId'],
        ...(occurrenceId === undefined ? {} : { occurrenceId }),
        ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    };
}
/** Parse and validate persisted concurrency JSON-compatible columns. */
export function decodeConcurrency(key, limit) {
    if (key === null && limit === null)
        return undefined;
    if (typeof key !== 'string' || typeof limit !== 'number')
        invalid('persisted concurrency is invalid');
    boundedText(key, 'concurrency key', 256);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000)
        invalid('persisted concurrency limit is invalid');
    return { key, limit };
}
/** Parse and validate persisted Target JSON. */
export function decodeTarget(value) {
    const record = plainRecord(value, 'target');
    exactKeys(record, ['kind', 'cwd'], ['preset', 'provider', 'model', 'permissionPreset'], 'target');
    if (record['kind'] !== 'fresh' || typeof record['cwd'] !== 'string' || !isAbsolute(record['cwd'])) {
        invalid('persisted target is invalid');
    }
    if (record['cwd'].length > 4_096)
        invalid('persisted target cwd is too long');
    const preset = optionalBoundedString(record['preset'], 'target preset', 256);
    const provider = optionalBoundedString(record['provider'], 'target provider', 256);
    const model = optionalBoundedString(record['model'], 'target model', 512);
    const permissionPreset = optionalBoundedString(record['permissionPreset'], 'target permission preset', 256);
    return {
        kind: 'fresh',
        cwd: record['cwd'],
        ...(preset === undefined ? {} : { preset }),
        ...(provider === undefined ? {} : { provider }),
        ...(model === undefined ? {} : { model }),
        ...(permissionPreset === undefined ? {} : { permissionPreset }),
    };
}
function optionalBoundedText(value, name, maxLength) {
    if (value !== undefined)
        boundedText(value, name, maxLength);
}
function triggerKind(value) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(value))
        invalid('trigger kind must be a lowercase adapter identifier');
}
function boundedText(value, name, maxLength) {
    if (value.trim() === '' || value.length > maxLength)
        invalid(`${name} must be between 1 and ${maxLength} characters`);
}
function optionalBoundedString(value, name, maxLength) {
    if (value === undefined)
        return undefined;
    if (typeof value !== 'string')
        invalid(`${name} must be a string`);
    boundedText(value, name, maxLength);
    return value;
}
function plainRecord(value, name) {
    if (typeof value !== 'object' || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
        invalid(`${name} must be a plain object`);
    }
    return value;
}
function exactKeys(record, required, optional, name) {
    const allowed = new Set([...required, ...optional]);
    if (required.some(key => !Object.hasOwn(record, key)) || Object.keys(record).some(key => !allowed.has(key))) {
        invalid(`${name} contains missing or unknown fields`);
    }
}
function invalid(message) {
    throw new AutomationError('INVALID_REQUEST', message);
}
//# sourceMappingURL=domain.js.map