// Prisma is imported lazily (inside the functions that need it) so that simply
// importing this module — or aiClient's pure helpers like extractJson — does not
// construct a DB client.
const getPrisma = async () => (await import("../db.js")).prisma;

// ---------------------------------------------------------------------------
// AI spend guard. Records token usage per call and enforces two soft caps:
//   • a rolling WINDOW cap (default $2 per 3 hours) — short-term burst control,
//   • a MONTHLY cap (default $18) — keeps you under your ~$20/mo API budget.
// This is a soft guard inside the app; the hard guarantee is the spend limit on
// the Anthropic Console. All numbers are env-tunable.
//
// Prices are per 1,000,000 tokens. Defaults are Claude Sonnet list pricing;
// override with AI_PRICE_IN_PER_M / AI_PRICE_OUT_PER_M if you change models.
// ---------------------------------------------------------------------------

const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

export const BUDGET = () => ({
  windowUsd: num(process.env.AI_BUDGET_WINDOW_USD, 2),
  windowHours: num(process.env.AI_BUDGET_WINDOW_HOURS, 3),
  monthUsd: num(process.env.AI_BUDGET_MONTH_USD, 18),
  priceInPerM: num(process.env.AI_PRICE_IN_PER_M, 3),   // Sonnet input  ($/1M)
  priceOutPerM: num(process.env.AI_PRICE_OUT_PER_M, 15), // Sonnet output ($/1M)
});

export class BudgetError extends Error {
  constructor(message) { super(message); this.name = "BudgetError"; this.status = 429; }
}

function startOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }

export function costOf(inputTokens, outputTokens) {
  const b = BUDGET();
  return (inputTokens / 1e6) * b.priceInPerM + (outputTokens / 1e6) * b.priceOutPerM;
}

// Returns current spend in the rolling window and this calendar month.
export async function getSpend() {
  const prisma = await getPrisma();
  const b = BUDGET();
  const winStart = new Date(Date.now() - b.windowHours * 3600 * 1000);
  const monStart = startOfMonth();
  const [w, m] = await Promise.all([
    prisma.aiUsage.aggregate({ _sum: { costUsd: true }, where: { createdAt: { gte: winStart } } }),
    prisma.aiUsage.aggregate({ _sum: { costUsd: true }, where: { createdAt: { gte: monStart } } }),
  ]);
  const winUsd = w._sum.costUsd || 0;
  const monUsd = m._sum.costUsd || 0;
  return {
    window: { usd: winUsd, limit: b.windowUsd, hours: b.windowHours, remaining: Math.max(0, b.windowUsd - winUsd) },
    month: { usd: monUsd, limit: b.monthUsd, remaining: Math.max(0, b.monthUsd - monUsd) },
  };
}

// Throws BudgetError if either cap is already reached (call before an AI request).
export async function assertWithinBudget() {
  // If disabled, skip the DB hit entirely.
  if (process.env.AI_BUDGET_DISABLED === "1") return;
  const { window, month } = await getSpend();
  if (month.usd >= month.limit)
    throw new BudgetError(`Monthly AI budget of $${month.limit} reached. It resets at the start of next month.`);
  if (window.usd >= window.limit)
    throw new BudgetError(`AI is paused — the $${window.limit} cap for the last ${window.hours}h was hit. It frees up within ${window.hours}h.`);
}

// Records a call's token usage + computed cost (fire-and-forget friendly).
export async function recordUsage(model, usage, userId = null) {
  if (!usage) return;
  const inTok = usage.input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  if (!inTok && !outTok) return;
  const prisma = await getPrisma();
  await prisma.aiUsage.create({
    data: { userId, model, inputTokens: inTok, outputTokens: outTok, costUsd: costOf(inTok, outTok) },
  });
}
