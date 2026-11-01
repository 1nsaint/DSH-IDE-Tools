import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Workspace picker with sidebar-matching colored folder icons.
 * @module
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { IconChevronDownOutline16, IconFolderFilled16 } from "./icons.js";
import { subscribeWorkspaceAccent, workspaceFolderColor, } from "./workspace-accent-bridge.js";
import css from './workspace-select.module.css';
function workspaceLabel(row) {
    return String(row.title || row.name || row.path || '').trim() || row.path || '';
}
function folderColorForPath(path, workspaces) {
    if (!path)
        return undefined;
    const hit = workspaces.find(w => w.path === path);
    return hit ? workspaceFolderColor(hit) : undefined;
}
export function WorkspaceSelect({ value, onChange, workspaces, defaultLabel, extraOptions = [], }) {
    const listId = useId();
    const rootRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [, setAccentTick] = useState(0);
    useEffect(() => subscribeWorkspaceAccent(() => { setAccentTick(t => t + 1); }), []);
    useEffect(() => {
        if (!open)
            return;
        const onDoc = (event) => {
            const node = rootRef.current;
            if (node && event.target instanceof Node && !node.contains(event.target)) {
                setOpen(false);
            }
        };
        const onKey = (event) => {
            if (event.key === 'Escape')
                setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);
    const selectedLabel = useMemo(() => {
        if (!value)
            return defaultLabel;
        const hit = workspaces.find(w => w.path === value);
        if (hit)
            return workspaceLabel(hit);
        const extra = extraOptions.find(o => o.value === value);
        return extra?.label ?? value;
    }, [value, workspaces, defaultLabel, extraOptions]);
    const triggerFolderColor = useMemo(() => folderColorForPath(value, workspaces), [value, workspaces]);
    const pick = (path) => {
        onChange(path);
        setOpen(false);
    };
    return (_jsxs("div", { className: css.root, ref: rootRef, children: [_jsxs("button", { type: "button", className: css.trigger, "aria-expanded": open, "aria-haspopup": "listbox", "aria-controls": open ? listId : undefined, onClick: () => { setOpen(current => !current); }, children: [_jsx(IconFolderFilled16, { size: 16, className: css.folderIcon, color: triggerFolderColor ?? 'var(--dsw-alias-label-tertiary)' }), _jsx("span", { className: css.triggerLabel, children: selectedLabel }), _jsx(IconChevronDownOutline16, { size: 16, className: css.chevron })] }), open ? (_jsxs("ul", { id: listId, className: css.menu, role: "listbox", "aria-label": defaultLabel, children: [_jsx("li", { role: "none", children: _jsxs("button", { type: "button", role: "option", "aria-selected": !value, className: `${css.option}${!value ? ` ${css.optionActive}` : ''}`, onClick: () => { pick(''); }, children: [_jsx(IconFolderFilled16, { size: 16, className: css.folderIcon, color: "var(--dsw-alias-label-tertiary)" }), _jsx("span", { className: css.optionLabel, children: defaultLabel })] }) }), workspaces.map(workspace => {
                        const path = workspace.path ?? '';
                        const label = workspaceLabel(workspace);
                        const color = workspaceFolderColor(workspace);
                        const active = value === path;
                        return (_jsx("li", { role: "none", children: _jsxs("button", { type: "button", role: "option", "aria-selected": active, className: `${css.option}${active ? ` ${css.optionActive}` : ''}`, onClick: () => { pick(path); }, children: [_jsx(IconFolderFilled16, { size: 16, className: css.folderIcon, color: color ?? 'var(--dsw-alias-label-secondary)' }), _jsx("span", { className: css.optionLabel, children: label })] }) }, workspace.workspaceId ?? path));
                    }), extraOptions.map(option => {
                        const active = value === option.value;
                        const color = folderColorForPath(option.value, workspaces);
                        return (_jsx("li", { role: "none", children: _jsxs("button", { type: "button", role: "option", "aria-selected": active, className: `${css.option}${active ? ` ${css.optionActive}` : ''}`, onClick: () => { pick(option.value); }, children: [_jsx(IconFolderFilled16, { size: 16, className: css.folderIcon, color: color ?? 'var(--dsw-alias-label-secondary)' }), _jsx("span", { className: css.optionLabel, children: option.label })] }) }, option.value));
                    })] })) : null] }));
}
//# sourceMappingURL=workspace-select.js.map