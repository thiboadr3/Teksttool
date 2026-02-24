import Store from "electron-store";
import type { CostRequestKind, CostSnapshot, TokenUsage } from "../../shared/types";

export interface CostStoreLike {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
}

interface CostStoreSchema {
  cost: CostSnapshot;
}

const PRICING_PER_1M_TOKENS: Record<string, { inputUsd: number; outputUsd: number }> = {
  "gpt-4o-mini": { inputUsd: 0.15, outputUsd: 0.6 },
  "gpt-4o": { inputUsd: 5, outputUsd: 15 },
  "gpt-4.1-mini": { inputUsd: 0.4, outputUsd: 1.6 }
};

const DEFAULT_COST_SNAPSHOT: CostSnapshot = {
  totalRequests: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalEstimatedCostUsd: 0,
  lastRequest: null,
  pricingNote: "Schatting op basis van token usage en lokale model-pricing (kan afwijken van OpenAI billing)."
};

function roundUsd(value: number): number {
  return Number(value.toFixed(8));
}

function estimateCostUsd(model: string, usage: TokenUsage): number | null {
  const pricing = PRICING_PER_1M_TOKENS[model];
  if (!pricing) {
    return null;
  }

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputUsd;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputUsd;
  return roundUsd(inputCost + outputCost);
}

export class CostService {
  constructor(private readonly store: CostStoreLike) {}

  getSnapshot(): CostSnapshot {
    const persisted = this.store.get("cost") as Partial<CostSnapshot> | undefined;
    return {
      ...DEFAULT_COST_SNAPSHOT,
      ...persisted
    };
  }

  recordUsage(kind: CostRequestKind, model: string, usage: TokenUsage): CostSnapshot {
    const current = this.getSnapshot();
    const estimatedCostUsd = estimateCostUsd(model, usage);

    const totalEstimatedCostUsd =
      estimatedCostUsd === null
        ? current.totalEstimatedCostUsd
        : roundUsd(current.totalEstimatedCostUsd + estimatedCostUsd);

    const updated: CostSnapshot = {
      ...current,
      totalRequests: current.totalRequests + 1,
      totalInputTokens: current.totalInputTokens + usage.inputTokens,
      totalOutputTokens: current.totalOutputTokens + usage.outputTokens,
      totalEstimatedCostUsd,
      lastRequest: {
        ...usage,
        kind,
        model,
        estimatedCostUsd,
        timestamp: Date.now()
      }
    };

    this.store.set("cost", updated);
    return updated;
  }
}

export function createCostService(): CostService {
  const store = new Store<CostStoreSchema>({
    name: "tekstnakijken-costs",
    defaults: {
      cost: DEFAULT_COST_SNAPSHOT
    }
  });

  return new CostService(store as unknown as CostStoreLike);
}
