/**
 * Sliding Memory System
 *
 * Keeps the last MAX_PAIRS message pairs (user + model) per chat.
 * Each pair = 2 messages, so MAX_PAIRS * 2 = total messages in history.
 */

const MAX_PAIRS = 5; // 5 user + 5 model = 10 messages total

/** @type {Map<string, Array<{role: string, parts: Array<{text: string}>}>>} */
const chatHistories = new Map();

/**
 * Adds a message to the chat history, sliding out the oldest pair if needed.
 * @param {string} chatId - WhatsApp chat ID
 * @param {'user' | 'model'} role - Role of the message sender
 * @param {string} text - Message text
 */
export function addMessage(chatId, role, text) {
  if (!chatHistories.has(chatId)) {
    chatHistories.set(chatId, []);
  }

  const history = chatHistories.get(chatId);
  history.push({ role, parts: [{ text }] });

  // Keep only the last MAX_PAIRS * 2 messages
  const maxMessages = MAX_PAIRS * 2;
  if (history.length > maxMessages) {
    // Remove the oldest pair (2 messages: one user, one model)
    history.splice(0, history.length - maxMessages);
  }
}

/**
 * Returns the chat history for a given chat ID.
 * @param {string} chatId
 * @returns {Array<{role: string, parts: Array<{text: string}>}>}
 */
export function getHistory(chatId) {
  return chatHistories.get(chatId) ?? [];
}

/**
 * Clears the chat history for a given chat ID.
 * @param {string} chatId
 */
export function clearHistory(chatId) {
  chatHistories.delete(chatId);
  console.log(`[Memory] Cleared history for chat: ${chatId}`);
}

/**
 * Returns memory stats for a given chat ID.
 * @param {string} chatId
 */
export function getMemoryStats(chatId) {
  const history = chatHistories.get(chatId) ?? [];
  return {
    totalMessages: history.length,
    maxMessages: MAX_PAIRS * 2,
    pairs: Math.floor(history.length / 2),
  };
}
