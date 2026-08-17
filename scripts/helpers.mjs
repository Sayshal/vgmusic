import { CONST } from './config.mjs';

/**
 * Utility helper functions
 */

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
  return game.settings.get(CONST.moduleId, CONST.settings.suppressedContexts).has(context);
}

/**
 * Suppress or release a context for every client
 * @param {string} context - Context key
 * @param {boolean} suppressed - Whether the context should be suppressed
 */
export async function setContextSuppressed(context, suppressed) {
  const contexts = new Set(game.settings.get(CONST.moduleId, CONST.settings.suppressedContexts));
  if (suppressed) contexts.add(context);
  else contexts.delete(context);
  await game.settings.set(CONST.moduleId, CONST.settings.suppressedContexts, contexts);
  ui.controls.initialize();
}

/**
 * Get property from object using dot notation
 * @param {object} object - Source object
 * @param {string} path - Dot notation path
 * @returns {*} Property value
 */
export function getProperty(object, path) {
  return foundry.utils.getProperty(object, path);
}

/**
 * Set property on object using dot notation
 * @param {object} object - Target object
 * @param {string} path - Dot notation path
 * @param {*} value - Value to set
 * @returns {boolean} Whether the property was set
 */
export function setProperty(object, path, value) {
  return foundry.utils.setProperty(object, path, value);
}

/**
 * Playlist context class for managing music contexts
 */
export class PlaylistContext {
  /**
   * @param {string} context - The context type ('area' or 'combat')
   * @param {Document} contextEntity - The entity providing the context
   * @param {object} playlist - The playlist to play
   * @param {string|null} trackId - Specific track ID or null for default
   * @param {number} priority - Priority level for sorting
   * @param {Document|null} scopeEntity - Entity for progress tracking
   */
  constructor(context, contextEntity, playlist, trackId, priority = 0, scopeEntity = null) {
    this.context = context;
    this.contextEntity = contextEntity;
    this.playlist = playlist;
    this.trackId = trackId;
    this.priority = priority;
    this.scopeEntity = scopeEntity;
  }

  /**
   * Get the track to play from this context
   * @returns {object|null} The track or null
   */
  get track() {
    if (this.trackId) return this.playlist?.sounds.get(this.trackId);
    const firstTrackId = this.playlist?.playbackOrder?.[0];
    return firstTrackId ? this.playlist.sounds.get(firstTrackId) : null;
  }

  /**
   * Create playlist context from document
   * @param {Document|object} document - Source document or data model
   * @param {string} type - Music type ('area' or 'combat')
   * @param {Document} scopeEntity - Scope entity for progress tracking
   * @returns {PlaylistContext|null} Created context or null
   */
  static fromDocument(document, type = 'combat', scopeEntity = null) {
    if (document instanceof foundry.abstract.Document) {
      const playlistId = document.getFlag(CONST.moduleId, `music.${type}.playlist`);
      const playlist = playlistId ? game.playlists.get(playlistId) : null;
      if (!playlist) return null;
      const trackId = document.getFlag(CONST.moduleId, `music.${type}.initialTrack`) || null;
      const priority = document.getFlag(CONST.moduleId, `music.${type}.priority`) ?? 0;
      return new this(type, document, playlist, trackId, priority, scopeEntity);
    }
    if (document?.constructor?.name === 'PrototypeToken') {
      const section = document.flags?.[CONST.moduleId]?.music?.[type];
      if (!section) return null;
      const playlistId = section.playlist;
      const playlist = playlistId ? game.playlists.get(playlistId) : null;
      if (!playlist) return null;
      const trackId = section.initialTrack || null;
      const priority = section.priority ?? 0;
      return new this(type, document, playlist, trackId, priority, scopeEntity);
    }
    if (document.documentName === 'DefaultMusic') {
      const section = document.data?.vgmusic?.music?.[type];
      if (!section) return null;
      const playlistId = section.playlist;
      const playlist = playlistId ? game.playlists.get(playlistId) : null;
      if (!playlist) return null;
      const trackId = section.initialTrack || null;
      const priority = section.priority ?? 0;
      return new this(type, document, playlist, trackId, priority, scopeEntity);
    }
    return null;
  }
}
