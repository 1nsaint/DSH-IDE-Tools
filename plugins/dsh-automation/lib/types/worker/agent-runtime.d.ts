/** Public DSH Agent composition for fresh and resumed automation Runs. */
import type { Context } from '@deepseek-ai/cordis';
import { type Agent, type AgentHandle } from '@deepseek-ai/dsh-agent';
import type { RunClaim, TargetSpec } from '../domain.ts';
export declare function createAutomationAgent(ctx: Context, claim: RunClaim, resume: boolean): Promise<AgentHandle>;
export declare function applyPermission(ctx: Context, agent: Agent, target: TargetSpec): void;
//# sourceMappingURL=agent-runtime.d.ts.map