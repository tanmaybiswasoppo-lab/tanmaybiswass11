/**
 * WhatsApp Bot — powered by Gemini AI
 *
 * Features:
 *  - Gemini AI responses with 3-model fallback chain
 *  - Sliding memory: last 10 messages (5 pairs) per chat
 *  - QR code in terminal for phone pairing
 *  - Session persistence via LocalAuth (no re-scan on restart)
 *
 * Commands:
 *  !clear   — wipe this chat's memory and start fresh
 *  !stats   — show current memory usage for this chat
 *  !help    — list available commands
 */

import pkg from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { execSync } from 'child_process';
import { generateResponse } from './gemini.js';
import { addMessage, getHistory, clearHistory, getMemoryStats } from './memory.js';

const { Client, LocalAuth } = pkg;

// Resolve system Chromium (required on NixOS / Replit)
let executablePath;
try {
  executablePath = execSync('which chromium || which chromium-browser || which google-chrome', {
    encoding: 'utf8',
  }).trim().split('\n')[0];
  console.log(`[Bot] Using system Chromium: ${executablePath}`);
} catch {
  console.warn('[Bot] System Chromium not found — falling back to puppeteer bundled Chrome.');
}

// ---------------------------------------------------------------------------
// WhatsApp client
// ---------------------------------------------------------------------------

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    executablePath: executablePath || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
    ],
  },
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

client.on('qr', (qr) => {
  console.log('\n========================================');
  console.log('  Scan this QR code with WhatsApp:');
  console.log('  (Phone → Linked Devices → Link a Device)');
  console.log('========================================\n');
  qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
  console.log('\n[Auth] ✓ Authenticated successfully.');
});

client.on('auth_failure', (msg) => {
  console.error('[Auth] ✗ Authentication failed:', msg);
  console.error('[Auth] Delete the .wwebjs_auth folder and restart to re-scan the QR code.');
});

client.on('ready', () => {
  console.log('\n[Bot] ✓ WhatsApp bot is ready and listening for messages.\n');
});

client.on('disconnected', (reason) => {
  console.warn('[Bot] Disconnected:', reason);
  console.warn('[Bot] Attempting to reinitialize...');
  client.initialize();
});

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

client.on('message', async (message) => {
  // Ignore broadcast, status, and non-text messages
  if (message.isStatus || message.broadcast || !message.body) return;

  const chatId = message.from;
  const text = message.body.trim();

  // --- Built-in commands ---
  if (text.startsWith('!')) {
    const command = text.toLowerCase();

    if (command === '!clear') {
      clearHistory(chatId);
      await message.reply('🧹 Memory cleared! Starting a fresh conversation.');
      return;
    }

    if (command === '!stats') {
      const stats = getMemoryStats(chatId);
      await message.reply(
        `📊 *Memory Stats*\n` +
        `Messages stored: ${stats.totalMessages} / ${stats.maxMessages}\n` +
        `Conversation pairs: ${stats.pairs} / 5`
      );
      return;
    }

    if (command === '!help') {
      await message.reply(
        `🤖 *Available Commands*\n\n` +
        `!clear — Wipe memory and start fresh\n` +
        `!stats — Show memory usage\n` +
        `!help  — Show this message\n\n` +
        `Just send any message to chat with the AI.`
      );
      return;
    }
  }

  // --- AI response ---
  const history = getHistory(chatId); // history before this message

  console.log(`[Message] From: ${chatId} | Text: "${text.slice(0, 80)}"`);

  try {
    // Add user message to memory before sending (so it's included if we retry)
    addMessage(chatId, 'user', text);

    // The history passed to Gemini must NOT include the current user message —
    // it is sent separately via chat.sendMessage(). So we use the history snapshot
    // captured before addMessage above.
    const { text: reply, modelUsed } = await generateResponse(history, text);

    // Store model reply
    addMessage(chatId, 'model', reply);

    await message.reply(reply);
    console.log(`[Reply] Model: ${modelUsed} | Length: ${reply.length} chars`);
  } catch (err) {
    console.error('[Bot] Failed to generate response:', err.message);
    await message.reply(
      '⚠️ Sorry, I couldn\'t get a response right now. Please try again in a moment.'
    );
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

console.log('[Bot] Starting WhatsApp bot...');
console.log('[Bot] If this is your first run, a QR code will appear below.\n');

client.initialize();
