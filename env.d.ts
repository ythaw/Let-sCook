declare namespace NodeJS {
  interface ProcessEnv {
    /** Google AI Studio / Gemini (preferred) */
    EXPO_PUBLIC_GEMINI_API_KEY?: string;
    /** Alias for the same key from Google AI Studio */
    EXPO_PUBLIC_GOOGLE_AI_API_KEY?: string;
    /** Legacy: still read if you haven’t renamed your .env yet (value should be your Gemini key) */
    EXPO_PUBLIC_OPENAI_API_KEY?: string;
    /** e.g. gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro */
    EXPO_PUBLIC_GEMINI_MODEL?: string;
    /** Optional; default https://generativelanguage.googleapis.com/v1beta/models */
    EXPO_PUBLIC_GEMINI_API_BASE?: string;
  }
}
