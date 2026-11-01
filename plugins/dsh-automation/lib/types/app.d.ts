/** Automation profile application: management commands or long-lived Worker. */
import type { Context } from '@deepseek-ai/cordis';
/** Stable Cordis plugin name. */
export declare const name = "dsh-automation-app";
/** The app waits for the parsed command and durable service. */
export declare const inject: string[];
/** Process-facing output streams; tests may substitute captures. */
export declare const internals: {
    stdout: {
        write(text: string): unknown;
    };
    stderr: {
        write(text: string): unknown;
    };
};
/** Execute the parsed automation application mode. */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=app.d.ts.map