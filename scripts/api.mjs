import { VGMusicConfig } from './apps/music-config.mjs';
import { MODULE } from './constants.mjs';
import { musicController } from './music-controller.mjs';
import { PlaylistContext } from './playlist-context.mjs';
import { getRegisteredSections, registerSection, unregisterSection } from './section-registry.mjs';

/**
 * Register a playlist section and hand back a handle for its lifetime
 * @param {object} definition - Section definition
 * @param {string} definition.id - Unique registry id
 * @param {string} definition.label - Localization key, used verbatim when it resolves to nothing
 * @param {number} [definition.priority] - Default sort priority
 * @param {string[]} [definition.types] - Document type names the section applies to
 * @param {Function} [definition.predicate] - Activation test, evaluated once per playlist refresh
 * @param {string} [definition.contextKey] - Context key used for flags and playback, defaults to the id
 * @returns {object|null} Handle exposing unregister and refresh, or null when the definition was rejected
 */
function registerSectionHandle(definition) {
  const section = registerSection(definition);
  if (!section) return null;
  musicController.playCurrentTrack();
  return {
    id: section.id,
    contextKey: section.contextKey,
    unregister: () => {
      unregisterSection(section.id);
      musicController.playCurrentTrack();
    },
    refresh: () => musicController.playCurrentTrack()
  };
}

/**
 * Publish the music API on the module entry and on the global namespace other 3DS modules read
 * @returns {void}
 */
export function exposeApi() {
  const api = {
    /** The controller driving playlist selection and playback. */
    musicController,

    /** The music configuration application. */
    VGMusicConfig,

    /** A resolved playlist candidate, exposed for consumers building their own. */
    PlaylistContext,

    /** Register a playlist section, returning a handle carrying unregister and refresh. */
    registerSection: registerSectionHandle,

    /** Remove a registered section by the id it was registered under. */
    unregisterSection,

    /** Read every registered section definition. */
    getRegisteredSections,

    /**
     * Re-run playlist selection, for when a section's predicate would now answer differently.
     * @returns {Promise<void>} Resolves once the transition has run
     */
    refreshSections: () => musicController.playCurrentTrack(),

    /**
     * Suppress a context until the returned token is released. Head GM only.
     * @param {string} context Context key to suppress
     * @returns {object|null} Token to pass back to releaseSuppression, or null off the head GM
     */
    requestSuppression: (context) => musicController.requestSuppression(context),

    /**
     * Release a suppression token taken by requestSuppression.
     * @param {object} token Token returned by requestSuppression
     * @returns {boolean} True if the token was live and has been released
     */
    releaseSuppression: (token) => musicController.releaseSuppression(token)
  };
  game.modules.get(MODULE.ID).api = api;
  globalThis.VGMUSIC = api;
}
