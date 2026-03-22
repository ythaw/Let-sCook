/**
 * Gemini vision: grocery photos / receipts → structured pantry rows.
 */

import { coercePantryCategory } from '../pantry/pantryItems';
import type { ParsedPantryImport } from '../pantry/usePantry';

const DEFAULT_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';

const VISION_PROMPT = `You are a grocery assistant. Look at this image. It may show groceries on a counter, inside a bag, a receipt, a fridge, or pantry shelves.

Return ONLY a JSON array (no markdown fences). Each element must be an object with:
- "name": string (ingredient or product name in English)
- "category": exactly one of: produce, dairy, meat_seafood, dry_goods, spices, frozen
  (use dry_goods for oils, pasta, rice, flour, canned goods, cereal, nuts, vinegar, stock; meat_seafood for meat, fish, tofu; dairy for milk, cheese, butter, eggs, yogurt; frozen for frozen foods)
- "quantity": number (use whole numbers; default 1 if unclear)
- "unit": optional string (e.g. "500 g", "1 head", "2 pcs")

For receipts, extract every food line item you can read. Skip non-food items (tax, total row, payment).
If you cannot read the image, return [].

Example output:
[{"name":"Broccoli","category":"produce","quantity":1,"unit":"1 head"}]`;

function parseJsonRows(text: string): unknown {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : t;
  return JSON.parse(raw) as unknown;
}

function toParsedRows(data: unknown): ParsedPantryImport[] {
  if (!Array.isArray(data)) return [];
  const out: ParsedPantryImport[] = [];
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim() : '';
    if (!name) continue;
    const qty =
      typeof r.quantity === 'number' && Number.isFinite(r.quantity)
        ? Math.max(1, Math.floor(r.quantity))
        : 1;
    const unit = typeof r.unit === 'string' ? r.unit.trim() : undefined;
    const catRaw = typeof r.category === 'string' ? r.category : '';
    const category = coercePantryCategory(catRaw, name);
    out.push({ name, category, quantity: qty, unit });
  }
  return out;
}

export async function analyzePantryImage(options: {
  apiKey: string;
  model: string;
  apiBaseUrl?: string;
  base64: string;
  mimeType: string;
}): Promise<ParsedPantryImport[]> {
  const { apiKey, model, apiBaseUrl, base64, mimeType } = options;
  const base = (apiBaseUrl ?? DEFAULT_API_BASE).replace(/\/$/, '');
  const url = `${base}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const cleanMime = mimeType.includes('/')
    ? mimeType
    : 'image/jpeg';
  const data = base64.replace(/^data:image\/\w+;base64,/, '');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: cleanMime, data } },
            { text: VISION_PROMPT },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      detail = j.error?.message ?? JSON.stringify(j);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    promptFeedback?: { blockReason?: string };
  };

  if (json.promptFeedback?.blockReason) {
    throw new Error(`Blocked: ${json.promptFeedback.blockReason}`);
  }

  const text =
    json.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';

  let rows: ParsedPantryImport[];
  try {
    rows = toParsedRows(parseJsonRows(text || '[]'));
  } catch {
    rows = toParsedRows(JSON.parse(text || '[]'));
  }

  return rows;
}
