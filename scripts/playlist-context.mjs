import { MODULE } from './constants.mjs';

/** Playlist context class for managing music contexts */
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
      const playlistId = document.getFlag(MODULE.ID, `music.${type}.playlist`);
      const playlist = playlistId ? game.playlists.get(playlistId) : null;
      if (!playlist) return null;
      const trackId = document.getFlag(MODULE.ID, `music.${type}.initialTrack`) || null;
      const priority = document.getFlag(MODULE.ID, `music.${type}.priority`) ?? 0;
      return new this(type, document, playlist, trackId, priority, scopeEntity);
    }
    if (document?.constructor?.name === 'PrototypeToken') {
      const section = document.flags?.[MODULE.ID]?.music?.[type];
      if (!section) return null;
      const playlistId = section.playlist;
      const playlist = playlistId ? game.playlists.get(playlistId) : null;
      if (!playlist) return null;
      const trackId = section.initialTrack || null;
      const priority = section.priority ?? 0;
      return new this(type, document, playlist, trackId, priority, scopeEntity);
    }
    if (document.documentName === 'DefaultMusic') {
      const section = document.data?.[MODULE.ID]?.music?.[type];
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
