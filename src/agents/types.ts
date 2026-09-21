export type AgentDefinition = {
  id: string;
  name: string;
  instructions: string;
  tools: string[];
};

/**
 * Agent module foundation for Phase 1.
 * Multi-step execution lands in Phase 4.
 */
export const agentModuleReady = true;
