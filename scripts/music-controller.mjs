import { DOCUMENT_SORT_PRIORITY, HOOKS, MODULE, SETTINGS, SILENT_MODES } from './constants.mjs';
import { PlaylistContext } from './playlist-context.mjs';
import { getRegisteredSections } from './section-registry.mjs';
import { isContextSuppressed, isHeadGM } from './utils.mjs';

/**
 * Get document type name, treating PrototypeToken as 'Token'
 * @param {Document|object} entity - The entity to check
 * @returns {string|undefined} The document type name
 */
function getEntityTypeName(entity) {
  if (entity?.documentName) return entity.documentName;
  if (entity?.constructor?.name === 'PrototypeToken') return 'Token';
  return undefined;
}

/**
 * Core music controller for managing playlist playback
 */
export class MusicController {
  /** Creates a new MusicController instance */
  constructor() {
    this.currentContext = null;
    this.suppressionTokens = new Set();
    this.suppressionCounts = new Map();
    this.activeSections = new Map();
    this.lastNowPlaying = null;
    this.playbackChain = Promise.resolve();
  }

  /**
   * Get the current combat for the active scene
   * @returns {object|undefined} The current combat or undefined
   */
  get currentCombat() {
    const scene = this.currentScene;
    return game.combats.find((combat) => combat.active && combat.scene === scene) ?? game.combats.find((combat) => combat.scene === scene) ?? game.combats.find((combat) => combat.active);
  }

  /**
   * Get the currently active scene
   * @returns {object|undefined} The active scene or undefined
   */
  get currentScene() {
    return game.scenes.find((scene) => scene.active);
  }

  /**
   * Get the currently playing track
   * @returns {object|null} The current track or null
   */
  get currentTrack() {
    return this.currentContext?.track;
  }

  /**
   * Get stored info for the current track
   * @returns {object} Track info or empty object
   */
  get currentTrackInfo() {
    if (!this.currentTrack) return {};
    const track = this.currentTrack;
    const info = this.currentContext?.scopeEntity?.getFlag(MODULE.ID, `playlist.${track.parent.id}.${track.id}`);
    return info;
  }

  /**
   * Check if game audio is ready for playback
   * @returns {boolean} True if audio is unlocked
   */
  isAudioReady() {
    return game.audio && !game.audio.locked;
  }

  /**
   * Wait for the first user gesture, then run the playback callback
   * @param {Function} playCallback - Function to call once audio is unlocked
   */
  async waitForAudio(playCallback) {
    await game.audio.unlock;
    await playCallback();
  }

  /**
   * Determine which document to use for combatant music
   * @param {object} token - The combatant's token
   * @param {object} actor - The combatant's actor
   * @returns {Document|object|null} The document to use for music lookup
   */
  _getCombatantMusicSource(token, actor) {
    if (!token && !actor) return null;
    const tokenHasMusic = token?.getFlag(MODULE.ID, 'music.combat.playlist');
    const prototypeToken = actor?.prototypeToken;
    const prototypeHasMusic = prototypeToken?.flags?.[MODULE.ID]?.music?.combat?.playlist;
    const actorHasMusic = actor?.getFlag(MODULE.ID, 'music.combat.playlist');
    if (token && !token.actorLink) {
      if (tokenHasMusic) return token;
      return actorHasMusic ? actor : null;
    }
    if (token && token.actorLink) {
      if (tokenHasMusic) {
        const useTokenMusic = token.getFlag(MODULE.ID, 'useTokenMusic');
        if (useTokenMusic || (!prototypeHasMusic && !actorHasMusic)) return token;
      }
      if (prototypeHasMusic) return prototypeToken;
    }
    return actorHasMusic ? actor : null;
  }

  /**
   * Get all current playlist contexts
   * @returns {PlaylistContext[]} Array of playlist contexts
   */
  getAllCurrentPlaylists() {
    const contexts = [];
    const scene = this.currentScene;
    const combat = this.currentCombat;
    if (scene) {
      const ctx = PlaylistContext.fromDocument(scene, 'area', scene);
      if (ctx) contexts.push(ctx);
    }
    if (scene) {
      const ctx = PlaylistContext.fromDocument(scene, 'combat', combat);
      if (ctx) contexts.push(ctx);
    }
    if (combat?.combatant) {
      for (const combatant of combat.combatants) {
        const musicSource = this._getCombatantMusicSource(combatant.token, combatant.actor);
        if (musicSource) {
          const ctx = PlaylistContext.fromDocument(musicSource, 'combat', combat);
          if (ctx) contexts.push(ctx);
        }
      }
    }
    if (combat) {
      const defaultConfig = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_MUSIC);
      if (defaultConfig) {
        const ctx = PlaylistContext.fromDocument(defaultConfig, 'combat', combat);
        if (ctx) contexts.push(ctx);
      }
    }
    for (const section of getRegisteredSections()) {
      try {
        for (const source of this._getSectionSources(section.types)) {
          const ctx = PlaylistContext.fromDocument(source, section.contextKey, scene);
          if (ctx) contexts.push(ctx);
        }
      } catch (error) {
        ATLAS.log(1, `Section "${section.id}" failed to resolve its music sources:`, error);
      }
    }
    return contexts;
  }

  /**
   * Collect the documents a registered section can draw music from
   * @param {string[]} types - Document type names the section applies to
   * @returns {Array<Document|object>} Candidate music sources
   */
  _getSectionSources(types) {
    const sources = [];
    const scene = this.currentScene;
    const combat = this.currentCombat;
    if (scene && types.includes('Scene')) sources.push(scene);
    if (types.includes('DefaultMusic')) {
      const defaultConfig = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_MUSIC);
      if (defaultConfig) sources.push(defaultConfig);
    }
    if (combat && (types.includes('Token') || types.includes('Actor'))) {
      for (const combatant of combat.combatants) {
        if (combatant.token && types.includes('Token')) sources.push(combatant.token);
        if (combatant.actor && types.includes('Actor')) sources.push(combatant.actor);
      }
    }
    return sources;
  }

  /**
   * Evaluate every registered section's activation predicate once for this refresh
   * @returns {Map<string, boolean>} Active state keyed by context
   */
  evaluateSections() {
    const active = new Map();
    for (const section of getRegisteredSections()) {
      let enabled = true;
      if (section.predicate) {
        try {
          enabled = !!section.predicate(this);
        } catch (error) {
          ATLAS.log(1, `Section predicate failed for ${section.id}:`, error);
          enabled = false;
        }
      }
      active.set(section.contextKey, enabled);
    }
    return active;
  }

  /**
   * Request suppression of a context, reference counted across callers
   * @param {string} context - Context key to suppress
   * @returns {object} Opaque token to pass back to releaseSuppression
   */
  requestSuppression(context) {
    if (!isHeadGM()) {
      ATLAS.log(2, 'Suppression tokens are a head GM operation, ignoring this request');
      return null;
    }
    const token = { context };
    this.suppressionTokens.add(token);
    this.suppressionCounts.set(context, (this.suppressionCounts.get(context) ?? 0) + 1);
    this.playCurrentTrack();
    return token;
  }

  /**
   * Release a suppression token
   * @param {object} token - Token returned by requestSuppression
   * @returns {boolean} True if the token was live and has been released
   */
  releaseSuppression(token) {
    if (!this.suppressionTokens.delete(token)) return false;
    this.suppressionCounts.set(token.context, Math.max(0, (this.suppressionCounts.get(token.context) ?? 0) - 1));
    this.playCurrentTrack();
    return true;
  }

  /**
   * Check whether a context is suppressed by tokens or the GM master switch
   * @param {string} context - Context key
   * @returns {boolean} True if the context is suppressed
   */
  isSuppressed(context) {
    if ((this.suppressionCounts.get(context) ?? 0) > 0) return true;
    return isContextSuppressed(context);
  }

  /**
   * Filter playlist contexts based on current state
   * @param {PlaylistContext} context - Context to filter
   * @returns {boolean} True if context should be included
   */
  filterPlaylists(context) {
    const combat = this.currentCombat;
    if (context.context === 'combat' && !combat?.started) return false;
    if (this.isSuppressed(context.context)) return false;
    if (this.activeSections.get(context.context) === false) return false;
    return true;
  }

  /**
   * Sort playlist contexts by priority
   * @param {PlaylistContext} a - First context
   * @param {PlaylistContext} b - Second context
   * @returns {number} Sort comparison result
   */
  sortPlaylists(a, b) {
    const combat = this.currentCombat;
    const currentCombatant = combat?.combatant;
    const currentToken = currentCombatant?.token;
    const currentActor = currentCombatant?.actor;
    const currentPrototype = currentActor?.prototypeToken;
    const isCurrentA = a.contextEntity === currentToken || a.contextEntity === currentActor || a.contextEntity === currentPrototype;
    const isCurrentB = b.contextEntity === currentToken || b.contextEntity === currentActor || b.contextEntity === currentPrototype;
    if (isCurrentA && !isCurrentB) return -1;
    if (isCurrentB && !isCurrentA) return 1;
    const silentMode = game.settings.get(MODULE.ID, SETTINGS.SILENT_COMBAT_MUSIC_MODE);
    if (silentMode === SILENT_MODES.LAST_ACTOR) {
      const combatants = combat?.turns || [];
      const startIdx = combat?.current?.turn || 0;
      if (startIdx >= 0 && combatants.length > 0) {
        let i = startIdx;
        do {
          i = (i - 1 + combatants.length) % combatants.length;
          const actor = combatants[i]?.actor;
          const prototype = actor?.prototypeToken;
          if (a.contextEntity === actor || a.contextEntity === prototype) return -1;
          if (b.contextEntity === actor || b.contextEntity === prototype) return 1;
        } while (i !== (startIdx + 1) % combatants.length);
      }
    } else if (silentMode === SILENT_MODES.AREA || silentMode === SILENT_MODES.GENERIC) {
      const preferred = silentMode === SILENT_MODES.AREA ? 'area' : 'combat';
      const aPreferred = getEntityTypeName(a.contextEntity) !== 'Actor' && a.context === preferred;
      const bPreferred = getEntityTypeName(b.contextEntity) !== 'Actor' && b.context === preferred;
      if (aPreferred !== bPreferred) return aPreferred ? -1 : 1;
    }
    if (a.priority !== b.priority) return b.priority - a.priority;
    const aTypeName = getEntityTypeName(a.contextEntity);
    const bTypeName = getEntityTypeName(b.contextEntity);
    if (aTypeName !== bTypeName) {
      const priorities = DOCUMENT_SORT_PRIORITY;
      return priorities.indexOf(bTypeName) - priorities.indexOf(aTypeName);
    }
    return 0;
  }

  /**
   * Get the current highest priority playlist context
   * @returns {PlaylistContext|null} Current context or null
   */
  getCurrentPlaylist() {
    this.activeSections = this.evaluateSections();
    const allContexts = this.getAllCurrentPlaylists();
    const filteredContexts = allContexts.filter((context) => {
      if (!this.filterPlaylists(context)) return false;
      if (context.track) return true;
      ATLAS.log(2, `Section "${context.context}" has no playable track on ${context.playlist?.name}, skipping it`);
      return false;
    });
    const sortedContexts = filteredContexts.sort(this.sortPlaylists.bind(this));
    return sortedContexts.length > 0 ? sortedContexts[0] : null;
  }

  /**
   * Play the current track based on context
   * @returns {Promise<void>} Resolves once this transition has run
   */
  async playCurrentTrack() {
    if (!isHeadGM() || !game.ready) return;
    const transition = this.playbackChain.then(async () => {
      const newContext = this.getCurrentPlaylist();
      if (!this.currentContext) await this.stopOrphanedTrack(newContext);
      await this.playMusic(newContext);
    });
    this.playbackChain = transition.catch(() => {});
    return transition;
  }

  /**
   * Stop a track left playing by a previous session or a previous head GM
   * @param {PlaylistContext|null} context - The context about to play
   */
  async stopOrphanedTrack(context) {
    const orphan = this.resolveNowPlaying(game.settings.get(MODULE.ID, SETTINGS.NOW_PLAYING));
    if (!orphan || orphan === context?.track || !orphan.playing) return;
    ATLAS.log(3, `Stopping ${orphan.name}, left playing by a previous session`);
    await orphan.update({ playing: false, pausedTime: null });
  }

  /**
   * Save current playlist data
   * @param {Document} entity - Entity to save data to
   */
  async savePlaylistData(entity) {
    if (entity instanceof Combat && !game.combats.get(entity.id)) return;
    if (!this.currentTrack || !entity || !isHeadGM()) return;
    const track = this.currentTrack;
    const flagData = { id: track.parent.id, trackId: track.id, start: (track.sound?.currentTime ?? 0) % (track.sound?.duration ?? 100) };
    await entity.setFlag(MODULE.ID, `playlist.${track.parent.id}.${track.id}`, flagData);
  }

  /**
   * Play music for a given context.
   * @param {PlaylistContext|null} context - Playlist context to play
   */
  async playMusic(context) {
    const prevTrack = this.currentTrack;
    const newTrack = context?.track;
    if (prevTrack === newTrack) {
      this.currentContext = context;
      await this.updateNowPlaying(context);
      return;
    }
    if (prevTrack) {
      await this.savePlaylistData(this.currentContext?.scopeEntity);
      if (this.isAudioReady()) await prevTrack.update({ playing: false, pausedTime: null });
      this.currentContext = null;
    }
    if (newTrack) {
      this.currentContext = context;
      const startTime = this.currentTrackInfo?.start ?? 0;
      await this.waitForAudio(async () => {
        await newTrack.update({ playing: true, pausedTime: startTime });
      });
    }
    await this.updateNowPlaying(context);
  }

  /**
   * Mirror the playing track into a world setting so every client can react to it
   * @param {PlaylistContext|null} context - The context now playing
   */
  async updateNowPlaying(context) {
    if (!isHeadGM()) return;
    const track = context?.track;
    const value = track ? { playlistId: track.parent.id, trackId: track.id, name: track.name, context: context.context } : null;
    const stored = game.settings.get(MODULE.ID, SETTINGS.NOW_PLAYING);
    if (this.sameNowPlaying(stored, value)) return;
    await game.settings.set(MODULE.ID, SETTINGS.NOW_PLAYING, value);
  }

  /**
   * Compare two now-playing payloads by the fields consumers react to
   * @param {object|null} a - First payload
   * @param {object|null} b - Second payload
   * @returns {boolean} True if both describe the same track in the same context
   */
  sameNowPlaying(a, b) {
    if (!a || !b) return !a && !b;
    return a.playlistId === b.playlistId && a.trackId === b.trackId && a.context === b.context;
  }

  /**
   * Resolve a mirrored now-playing value back to its track
   * @param {object|null} mirror - Stored now-playing value
   * @returns {object|null} The track, or null
   */
  resolveNowPlaying(mirror) {
    if (!mirror) return null;
    return game.playlists.get(mirror.playlistId)?.sounds.get(mirror.trackId) ?? null;
  }

  /**
   * Fire the trackChanged hook from a now-playing setting change
   * @param {object|null} value - New now-playing value
   */
  emitTrackChanged(value) {
    const previous = this.lastNowPlaying;
    this.lastNowPlaying = value;
    if (this.sameNowPlaying(previous, value)) return;
    const prev = this.resolveNowPlaying(previous);
    const current = this.resolveNowPlaying(value);
    Hooks.callAll(HOOKS.TRACK_CHANGED, { prev, current, context: value?.context ?? null });
  }
}

/** The module's controller instance */
export const musicController = new MusicController();
