/** Shared chat turn shape for Gemini (and any future providers). */
export type ChefChatTurn = { role: 'user' | 'assistant'; content: string };
