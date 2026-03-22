/**
 * ElevenLabs: speech-to-text (Scribe) + text-to-speech.
 * EXPO_PUBLIC_* keys ship in the client — fine for hackathon demos; use a backend for production.
 */

const STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
const TTS_BASE = 'https://api.elevenlabs.io/v1/text-to-speech';

export const DEFAULT_STT_MODEL = 'scribe_v2';
export const DEFAULT_TTS_MODEL = 'eleven_multilingual_v2';

export function readElevenLabsConfigFromEnv(): {
  apiKey: string | undefined;
  voiceId: string | undefined;
  sttModel: string;
  ttsModel: string;
} {
  const apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY?.trim() || undefined;
  const voiceId =
    process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID?.trim() || undefined;
  const sttModel =
    process.env.EXPO_PUBLIC_ELEVENLABS_STT_MODEL?.trim() || DEFAULT_STT_MODEL;
  const ttsModel =
    process.env.EXPO_PUBLIC_ELEVENLABS_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL;
  return { apiKey, voiceId, sttModel, ttsModel };
}

function parseSttJson(json: unknown): string {
  if (!json || typeof json !== 'object') return '';
  const o = json as Record<string, unknown>;
  if (typeof o.text === 'string') return o.text.trim();
  const transcripts = o.transcripts;
  if (Array.isArray(transcripts) && transcripts.length > 0) {
    const first = transcripts[0] as Record<string, unknown>;
    if (typeof first.text === 'string') return first.text.trim();
  }
  return '';
}

/** Transcribe a local recording (e.g. from expo-av). Use m4a on iOS/Android. */
export async function transcribeAudioFromUri(options: {
  apiKey: string;
  fileUri: string;
  filename?: string;
  mimeType?: string;
  modelId?: string;
}): Promise<string> {
  const {
    apiKey,
    fileUri,
    filename = 'recording.m4a',
    mimeType = 'audio/m4a',
    modelId = DEFAULT_STT_MODEL,
  } = options;

  const form = new FormData();
  form.append('model_id', modelId);
  form.append('tag_audio_events', 'false');
  form.append(
    'file',
    { uri: fileUri, name: filename, type: mimeType } as unknown as Blob
  );

  const res = await fetch(STT_URL, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
    },
    body: form,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { detail?: unknown };
      detail =
        typeof j.detail === 'string'
          ? j.detail
          : JSON.stringify(j.detail ?? j);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }

  const json = (await res.json()) as unknown;
  return parseSttJson(json);
}

/** Returns MP3 bytes (default output format from API). */
export async function synthesizeSpeechToMp3(options: {
  apiKey: string;
  voiceId: string;
  text: string;
  modelId?: string;
}): Promise<ArrayBuffer> {
  const { apiKey, voiceId, text, modelId = DEFAULT_TTS_MODEL } = options;
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('No text to speak.');
  }
  const maxLen = 4500;
  const payload =
    trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}…` : trimmed;

  const url = `${TTS_BASE}/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: payload,
      model_id: modelId,
    }),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { detail?: unknown };
      detail =
        typeof j.detail === 'string'
          ? j.detail
          : JSON.stringify(j.detail ?? j);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }

  return res.arrayBuffer();
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(
      null,
      slice as unknown as number[]
    );
  }
  return globalThis.btoa(binary);
}
