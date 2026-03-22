/**
 * Removes optional wake phrases (e.g. "Chef, ", "Hey kitchen ") so the rest still maps to commands.
 * Hands-free hotword listening without tapping the mic is not supported — say codename + command in one recording.
 */
export function stripVoiceWakePrefix(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const stripped = t.replace(
    /^\s*(hey\s+)?(chef|kitchen|let'?s\s*cook)\s*[,:]?\s+/i,
    ''
  );
  return stripped.trim();
}

/** Parsed from ElevenLabs transcript while in step-by-step voice cooking mode. */
export type VoiceCookCommand =
  | 'next'
  | 'previous'
  | 'repeat'
  | 'exit'
  | 'unknown';

/**
 * Map free-form speech to a cooking navigation command.
 * Keep phrases short and kitchen-friendly for hackathon demos.
 */
export function parseVoiceCookCommand(raw: string): VoiceCookCommand {
  const t = raw
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s']/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return 'unknown';

  if (t === 'back') return 'previous';

  const exitRe =
    /\b(stop cooking|exit|quit|cancel|end cooking|never mind|forget it)\b/;
  if (exitRe.test(t)) return 'exit';

  const prevRe =
    /\b(previous|go back|back up|last step|before that|i missed|missed that|go to previous)\b/;
  if (prevRe.test(t)) return 'previous';

  const repeatRe =
    /\b(repeat|say again|hear that again|one more time|what was that|again please)\b/;
  if (repeatRe.test(t)) return 'repeat';

  const nextRe =
    /\b(next|next step|continue|go on|move on|done|finished|i'm done|im done|got it|okay|ok|yes|ready|let's go|lets go)\b/;
  if (nextRe.test(t)) return 'next';

  return 'unknown';
}
