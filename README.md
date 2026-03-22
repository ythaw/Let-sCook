# Let’s Cook

A React Native (Expo) cooking companion: browse recipes that match your pantry, manage ingredients, build a shopping list, and chat with an AI chef—with **Google Gemini** for smart replies and **ElevenLabs** for voice assistant in the kitchen.

## Features

- **Home** — Filter demo recipes by meal type; see what you can make with what you have (or almost have).
- **Pantry** — Categories (produce, dairy, meat & seafood, dry goods, spices, frozen), search, low-stock filter, manual add, and **photo / receipt import** via Gemini vision (with a **review step** before items are saved). Starts from a **default starter pantry** you can edit anytime.
- **Shopping** — Shopping list with smart suggestions and flows tied to your pantry and recipes.
- **Profile** — Preferences and profile-related settings.
- **Chef chat** — Full-screen assistant with recipe chips, Gemini-powered answers when a key is set, offline fallbacks when not, **pantry-aware** prompts, optional **“cooked this → update pantry”** after a recipe walkthrough, and **voice cooking mode** (step-by-step: next / back / repeat / exit) with ElevenLabs speech-to-text and text-to-speech on device.

## Tech stack

- **Expo SDK 54** · **React Native** · **TypeScript**
- **React Navigation** (tabs + stack for chat)
- **Google Gemini** (REST `generateContent` in `src/ai/geminiChef.ts` and vision in `src/ai/geminiPantryImage.ts`)
- **ElevenLabs** REST API for STT + TTS (`src/ai/elevenlabsVoice.ts`)
- **expo-image-picker** · **expo-av** · **expo-file-system**

## Prerequisites

- **Node.js** (LTS recommended)
- **npm** (or use `pnpm` / `yarn` if you prefer—commands below use `npm`)
- For physical devices: **Expo Go** app, or a dev client from `expo run:ios` / `expo run:android`

## Quick start

```bash
git clone <your-repo-url>
cd Let-sCook
npm install
```

Copy environment variables and fill in keys as needed:

```bash
cp .env.example .env
```

Edit `.env`, then start the dev server:

```bash
npm start
```

Press `i` / `a` / `w` in the terminal for iOS simulator, Android emulator, or web (voice features are limited on web; use a phone + Expo Go for mic and full audio).

**Important:** After any change to `.env`, restart the Expo process (`Ctrl+C`, then `npm start` again).

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `EXPO_PUBLIC_GEMINI_API_KEY` | Optional* | Gemini API key from [Google AI Studio](https://aistudio.google.com/). Also accepts `EXPO_PUBLIC_GOOGLE_AI_API_KEY`. |
| `EXPO_PUBLIC_GEMINI_MODEL` | Optional | Model id (default in `.env.example` is a fast, widely available option). |
| `EXPO_PUBLIC_GEMINI_API_BASE` | Optional | Override only if Google documents a different base URL. |
| `EXPO_PUBLIC_ELEVENLABS_API_KEY` | Optional | ElevenLabs API key for voice transcription and TTS in chef chat. |
| `EXPO_PUBLIC_ELEVENLABS_VOICE_ID` | Optional** | Voice id from the ElevenLabs **Voices** page (needed for read-aloud). |
| `EXPO_PUBLIC_ELEVENLABS_STT_MODEL` | Optional | Default: `scribe_v2`. |
| `EXPO_PUBLIC_ELEVENLABS_TTS_MODEL` | Optional | Default: `eleven_multilingual_v2`. |

\*Without a Gemini key, the app uses **offline demo** chef and recipe text where implemented.  
\**STT can use the API key alone; **TTS / read-aloud** needs both key and `VOICE_ID`.

`EXPO_PUBLIC_*` variables are **embedded in the client bundle**. That is acceptable for local demos and hackathons; for production, call Gemini and ElevenLabs from a **backend** and keep secrets server-side.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server (Metro). |
| `npm run android` | Build/run native Android (dev client). |
| `npm run ios` | Build/run native iOS (dev client). |
| `npm run web` | Run in the browser. |

Typecheck:

```bash
npx tsc --noEmit
```

## Project layout (high level)

```
App.tsx                 # Fonts, navigation, pantry provider
src/
  ai/                   # Gemini chef, pantry image, ElevenLabs voice
  chef/                 # Voice cooking command parsing
  data/                 # Demo recipes, profile, recipe helpers
  navigation/           # Tab + stack types
  pantry/               # Types, default pantry, context, hooks
  profile/              # Persisted preferences
  screens/              # Home, Pantry, Shopping, Profile, Chat
  shopping/             # List logic, suggestions, storage
  theme/                # Colors, typography
```

## Troubleshooting

- **Pantry photo import fails** — Ensure `EXPO_PUBLIC_GEMINI_API_KEY` is set and restart the dev server. Grant camera / photo permissions when prompted.
- **No voice output** — Confirm ElevenLabs **API key** and **voice id**; on iOS/Android use a **real device** or emulator with audio; web has limited support.
- **Mic not working** — Grant microphone permission; `app.json` includes the `expo-av` plugin for permission strings on iOS.
- **Empty chef replies** — Check model name and quota in Google AI Studio; verify network access from the device.

## License

Private project unless you add a license file. If this is a hackathon repo, add your team’s license and sponsor credits as needed.
