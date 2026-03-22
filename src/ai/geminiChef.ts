/**
 * Google Gemini (AI Studio) — generateContent API.
 *
 * Security: EXPO_PUBLIC_* is embedded in the client — OK for personal dev;
 * use a backend proxy for production store builds.
 */

import type { ChefChatTurn } from './chefChatTypes';

const DEFAULT_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';

type GeminiPart = { text: string };
type GeminiContent = { role: string; parts: GeminiPart[] };

/** Gemini expects roles to alternate user / model; merge consecutive same-role lines. */
function buildGeminiContents(messages: ChefChatTurn[]): GeminiContent[] {
  type Turn = { role: 'user' | 'model'; text: string };
  let turns: Turn[] = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    text: m.content,
  }));

  if (turns.length === 0) {
    return [{ role: 'user', parts: [{ text: 'Hello.' }] }];
  }

  if (turns[0].role === 'model') {
    turns = [
      {
        role: 'user',
        text: 'Continuing from the in-app thread (assistant messages below are prior app copy).',
      },
      ...turns,
    ];
  }

  const out: GeminiContent[] = [];
  for (const t of turns) {
    const last = out[out.length - 1];
    if (last && last.role === t.role) {
      last.parts[0].text += '\n\n' + t.text;
    } else {
      out.push({ role: t.role, parts: [{ text: t.text }] });
    }
  }
  return out;
}

export async function completeChefChat(options: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: ChefChatTurn[];
  /** Override API base, e.g. same host without trailing slash; default Google AI Studio */
  apiBaseUrl?: string;
}): Promise<string> {
  const { apiKey, model, systemPrompt, messages, apiBaseUrl } = options;
  const base = (apiBaseUrl ?? DEFAULT_API_BASE).replace(/\/$/, '');
  const url = `${base}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = buildGeminiContents(messages);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig: {
        temperature: 0.55,
        maxOutputTokens: 1800,
      },
    }),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as {
        error?: { message?: string; status?: string };
      };
      detail = j.error?.message ?? JSON.stringify(j);
    } catch {
      try {
        detail = await res.text();
      } catch {
        /* ignore */
      }
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: GeminiPart[] };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  };

  const block = data.promptFeedback?.blockReason;
  if (block) {
    throw new Error(`Prompt blocked: ${block}`);
  }

  const parts = data.candidates?.[0]?.content?.parts;
  const text = parts?.map((p) => p.text).join('')?.trim();
  if (!text) {
    const reason = data.candidates?.[0]?.finishReason;
    throw new Error(
      reason
        ? `Empty response (finish: ${reason}).`
        : 'Empty response from the model.'
    );
  }
  return text;
}

export function readGeminiConfigFromEnv(): {
  apiKey: string | undefined;
  model: string;
  apiBaseUrl: string | undefined;
} {
  const apiKey =
    process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim() ||
    process.env.EXPO_PUBLIC_GOOGLE_AI_API_KEY?.trim() ||
    process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim() ||
    undefined;
  const model =
    process.env.EXPO_PUBLIC_GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
  const apiBaseUrl =
    process.env.EXPO_PUBLIC_GEMINI_API_BASE?.trim() || undefined;
  return { apiKey, model, apiBaseUrl };
}
