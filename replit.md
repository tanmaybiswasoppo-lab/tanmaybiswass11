# WhatsApp AI Bot

A WhatsApp bot powered by Google Gemini AI with a 3-model fallback chain and sliding per-chat memory.

## Run & Operate

- `pnpm --filter @workspace/whatsapp-bot run start` — run the WhatsApp bot (shows QR code in console)
- The **WhatsApp Bot** workflow runs it automatically — check the console tab to see the QR code

## Stack

- pnpm workspaces, Node.js 24
- WhatsApp: `whatsapp-web.js` (with `LocalAuth` for session persistence)
- AI: `@google/generative-ai` — Gemini 2.5 Flash → 2.0 Flash Lite → Gemma 3 27B fallback chain
- Chromium: System Chromium via Nix (NixOS-compatible puppeteer setup)

## Where things live

- `bots/whatsapp-bot/src/index.js` — bot entry point, WhatsApp client, message handler
- `bots/whatsapp-bot/src/gemini.js` — Gemini AI client with 3-model fallback
- `bots/whatsapp-bot/src/memory.js` — sliding window memory (5 pairs / 10 messages per chat)
- `bots/whatsapp-bot/.wwebjs_auth/` — auto-created session files (do not delete unless re-pairing)

## Architecture decisions

- **Model fallback order**: `gemini-2.5-flash` → `gemini-2.0-flash-lite` → `gemma-3-27b-it`. Any error (429, 503, network) triggers the next model automatically; 401/403 auth errors throw immediately.
- **Sliding memory**: each chat keeps at most 10 messages (5 user + 5 model). Oldest pair is dropped when the limit is reached — no manual pruning needed.
- **System Chromium**: puppeteer is configured to use the Nix-installed `/nix/store/.../chromium` binary instead of its bundled download, which lacks required shared libs on NixOS.
- **LocalAuth**: WhatsApp session is persisted to `.wwebjs_auth/` so you only need to scan the QR once.

## Bot commands (send in WhatsApp)

| Command | Effect |
|---------|--------|
| `!clear` | Wipe this chat's memory |
| `!stats` | Show memory usage for this chat |
| `!help`  | List all commands |

Any other message is sent to Gemini and replied to.

## User preferences

_Populate as you build._

## Gotchas

- Delete `.wwebjs_auth/` and restart if the bot is stuck and not connecting (forces a new QR scan).
- The QR code expires after ~30 seconds — restart the workflow to get a fresh one.
- `GEMINI_API_KEY` must be set as a Replit Secret before starting.
