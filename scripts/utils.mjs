import { MODULE, SETTINGS } from './constants.mjs';

/**
 * Get the first available GM user
 * @returns {object|null} First active GM user
 */
export function getFirstAvailableGM() {
  return game.users.filter((user) => user.isGM && user.active).sort((a, b) => a.id.localeCompare(b.id))[0] || null;
}

/**
 * Check if current user is the head GM
 * @returns {boolean} True if current user is head GM
 */
export function isHeadGM() {
  return game.user === getFirstAvailableGM();
}

/**
 * Check whether a context is held down by the GM master switch
 * @param {string} context - Context key
 * @returns {boolean} True if the GM has suppressed this context
 */
export function isContextSuppressed(context) {
  return game.settings.get(MODULE.ID, SETTINGS.SUPPRESSED_CONTEXTS).has(context);
}

/**
 * Suppress or release a context for every client
 * @param {string} context - Context key
 * @param {boolean} suppressed - Whether the context should be suppressed
 */
export async function setContextSuppressed(context, suppressed) {
  const contexts = new Set(game.settings.get(MODULE.ID, SETTINGS.SUPPRESSED_CONTEXTS));
  if (suppressed) contexts.add(context);
  else contexts.delete(context);
  await game.settings.set(MODULE.ID, SETTINGS.SUPPRESSED_CONTEXTS, contexts);
  ui.controls.initialize();
}
