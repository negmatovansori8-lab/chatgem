import { readJsonFile, writeJsonFile } from "@/lib/local-store";
import type { AgentRecord, AgentRunRecord } from "@/types/agents";

type Store = { agents: AgentRecord[]; runs: AgentRunRecord[] };

async function load(): Promise<Store> {
  return readJsonFile<Store>("agents.json", { agents: [], runs: [] });
}

async function save(store: Store) {
  await writeJsonFile("agents.json", store);
}

function now() {
  return new Date().toISOString();
}

export const agentRepository = {
  async list(userId: string) {
    const store = await load();
    return store.agents
      .filter((a) => a.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(userId: string, id: string) {
    const store = await load();
    return store.agents.find((a) => a.id === id && a.userId === userId) ?? null;
  },

  async create(
    userId: string,
    input: { name: string; description?: string; instructions: string; tools?: string[] },
  ) {
    const store = await load();
    const stamp = now();
    const agent: AgentRecord = {
      id: crypto.randomUUID(),
      userId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      instructions: input.instructions,
      tools: input.tools ?? [],
      isActive: true,
      createdAt: stamp,
      updatedAt: stamp,
    };
    store.agents.unshift(agent);
    await save(store);
    return agent;
  },

  async remove(userId: string, id: string) {
    const store = await load();
    const before = store.agents.length;
    store.agents = store.agents.filter((a) => !(a.id === id && a.userId === userId));
    store.runs = store.runs.filter((r) => {
      const agent = store.agents.find((a) => a.id === r.agentId);
      return agent !== undefined || r.agentId !== id;
    });
    // also drop runs for deleted agent
    store.runs = store.runs.filter((r) => r.agentId !== id);
    await save(store);
    return store.agents.length < before;
  },

  async listRuns(userId: string, agentId: string) {
    const agent = await this.get(userId, agentId);
    if (!agent) return null;
    const store = await load();
    return store.runs
      .filter((r) => r.agentId === agentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createRun(userId: string, agentId: string, input: string) {
    const agent = await this.get(userId, agentId);
    if (!agent) return null;
    const store = await load();
    const stamp = now();
    const run: AgentRunRecord = {
      id: crypto.randomUUID(),
      agentId,
      status: "RUNNING",
      input,
      output: null,
      progress: [
        { step: "intent", detail: "Parsed user request" },
        { step: "plan", detail: "Built plan from agent instructions" },
        {
          step: "tools",
          detail: agent.tools.length
            ? `Tools noted: ${agent.tools.join(", ")}`
            : "No tools selected",
        },
      ],
      createdAt: stamp,
      updatedAt: stamp,
    };

    try {
      const { bootstrapProviders, listSelectableModels, resolveProviderForModel } =
        await import("@/providers/ai/registry");
      bootstrapProviders();
      const model =
        listSelectableModels().find((m) => m.configured && m.kind === "chat") ??
        listSelectableModels().find((m) => m.configured);
      const provider = model ? resolveProviderForModel(model.id) : undefined;

      if (!provider?.generate || !model) {
        run.status = "COMPLETED";
        run.output =
        "AI provider not configured. Set GROQ_API_KEY or OPENAI_API_KEY to run agents.";
        run.progress.push({
          step: "validation",
          detail: "Provider missing — no fabricated agent answer.",
        });
      } else {
        run.progress.push({ step: "model", detail: `Calling ${model.name}` });
        const result = await provider.generate({
          modelId: model.id,
          messages: [
            {
              role: "system",
              content: `You are ChatGem agent "${agent.name}".\n${agent.instructions}`,
            },
            { role: "user", content: input },
          ],
          temperature: 0.3,
        });
        run.status = "COMPLETED";
        run.output = result.content;
        run.progress.push({ step: "validation", detail: "Model response received" });
      }
    } catch (error) {
      run.status = "FAILED";
      run.output =
        error instanceof Error ? error.message : "Agent run failed";
      run.progress.push({ step: "error", detail: run.output });
    }

    run.updatedAt = now();
    store.runs.unshift(run);
    await save(store);
    return run;
  },
};
