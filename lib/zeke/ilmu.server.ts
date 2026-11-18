// FROZEN (v2) — SERVER ONLY. Minimal OpenAI-compatible client for the ILMU API (onshore inference).
// Env: ILMU_API_KEY, ILMU_BASE_URL (default https://api.ilmu.ai/v1), ILMU_MODEL (default ilmu-mini-v3.3),
// ILMU_VISION_MODEL (default ilmu-vision-v1.3). Never send private keys, full account numbers or ID numbers.
export class ZekeUnavailable extends Error {}

const BASE = process.env.ILMU_BASE_URL ?? 'https://api.ilmu.ai/v1';
export const ILMU_MODEL = process.env.ILMU_MODEL ?? 'ilmu-mini-v3.3';
export const ILMU_VISION_MODEL = process.env.ILMU_VISION_MODEL ?? 'ilmu-vision-v1.3';

export type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string | unknown[]; tool_calls?: unknown[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };
export type AssistantMessage = { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] };

export async function ilmuChat(p: {
  messages: ChatMessage[];
  tools?: readonly unknown[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<AssistantMessage> {
  const key = process.env.ILMU_API_KEY;
  if (!key) throw new ZekeUnavailable('ILMU_API_KEY is not set');
  let res: Response;
  try {
    res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: p.model ?? ILMU_MODEL,
        messages: p.messages,
        ...(p.tools ? { tools: p.tools, tool_choice: 'auto' } : {}),
        temperature: p.temperature ?? 0.1,
        max_tokens: p.maxTokens ?? 600,
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ZekeUnavailable('Zeke is unavailable — use the normal screens');
  }
  if (res.status === 429 || res.status >= 500) throw new ZekeUnavailable('Zeke is busy — try again shortly');
  if (!res.ok) throw new ZekeUnavailable(`Zeke error ${res.status}`);
  const j = await res.json();
  const msg = j?.choices?.[0]?.message;
  if (!msg) throw new ZekeUnavailable('Zeke returned nothing');
  return { role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls };
}

/** Pull the first {...} JSON object out of a model reply (models sometimes wrap JSON in prose or fences). */
export function extractJson(text: string | null): unknown {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}
