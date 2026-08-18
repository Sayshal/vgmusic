import { MODULE, SETTINGS } from './constants.mjs';

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
