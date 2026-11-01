/** Model-facing automation task messages. */
import type { RunClaim } from '../domain.ts';
export declare function automationMessage(claim: RunClaim): {
    content: {
        type: "text";
        text: string;
    }[];
    source: {
        kind: "plugin";
        plugin: string;
    };
} & Pick<import("@deepseek-ai/dsh-llm").UserMessage, "id" | "role">;
//# sourceMappingURL=messages.d.ts.map