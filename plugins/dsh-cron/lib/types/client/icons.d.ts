/**
 * Plugin-local icon set in the dsh web UI glyph style (ic_ds_*): monochrome
 * filled paths, `fill="currentColor"`, square viewBox, {size, className}
 * props. Path data for the pause/check/trash glyphs mirrors the core
 * `@deepseek-ai/dsh-client-ui-primitives` icons so the panel keeps the
 * design-system look without cross-plugin value imports.
 * @module
 */
import type { ReactElement } from 'react';
export interface IconProps {
    /** Square edge in px; defaults to the glyph's own drawn size. */
    size?: number | undefined;
    /** Extra class for layout placement; color rides currentColor. */
    className?: string | undefined;
    /** Override fill color (sidebar folder accents). */
    color?: string | undefined;
}
/** Filled folder (sidebar workspace glyph style). */
export declare const IconFolderFilled16: ({ size, className, color }: IconProps) => ReactElement;
/** ic_ds_clock_outline_16: ring + 10:10 rounded hands (design-system style). */
export declare const IconClockOutline16: ({ size, className }: IconProps) => ReactElement;
/** ic_ds_pause_outline_16 (mirrors @deepseek-ai/dsh-client-ui-primitives). */
export declare const IconPauseOutline16: ({ size, className }: IconProps) => ReactElement;
/** ic_ds_check_outline_14 (mirrors @deepseek-ai/dsh-client-ui-primitives). */
export declare const IconCheckOutline14: ({ size, className }: IconProps) => ReactElement;
/** Compact close glyph for modal chrome. */
export declare const IconCloseOutline16: ({ size, className }: IconProps) => ReactElement;
/** Compact list glyph for "all tasks". */
export declare const IconListOutline16: ({ size, className }: IconProps) => ReactElement;
/** Compact plus glyph for the create action. */
export declare const IconPlusOutline16: ({ size, className }: IconProps) => ReactElement;
/** Compact disclosure chevron for expandable task rows. */
export declare const IconChevronDownOutline16: ({ size, className }: IconProps) => ReactElement;
//# sourceMappingURL=icons.d.ts.map