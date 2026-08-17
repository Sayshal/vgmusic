import { CONST, getRegisteredSections } from './config.mjs';
import { isHeadGM, PlaylistContext } from './helpers.mjs';

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
    this.pendingPlayback = null;
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
    return game.combats.find((combat) => combat.scene === this.currentScene) || game.combats.find((combat) => combat.active);
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
    const info = this.currentContext?.scopeEntity?.getFlag(CONST.moduleId, `playlist.${track.parent.id}.${track.id}`);
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
   * Wait for audio to be ready or defer playback
   * @param {Function} playCallback - Function to call when audio is ready
   */
  async waitForAudio(playCallback) {
    if (this.isAudioReady()) {
      await playCallback();
    } else {
      this.pendingPlayback = playCallback;
      const onAudioUnlock = async () => {
        if (this.pendingPlayback) {
          await this.pendingPlayback();
          this.pendingPlayback = null;
        }
        document.removeEventListener('click', onAudioUnlock);
        document.removeEventListener('keydown', onAudioUnlock);
      };
      document.addEventListener('click', onAudioUnlock, { once: true });
      document.addEventListener('keydown', onAudioUnlock, { once: true });
    }
  }

  /**
   * Determine which document to use for combatant music
   * @param {object} token - The combatant's token
   * @param {object} actor - The combatant's actor
   * @returns {Document|object|null} The document to use for music lookup
   */
  _getCombatantMusicSource(token, actor) {
    if (!token && !actor) return null;
    const tokenHasMusic = token?.getFlag(CONST.moduleId, 'music.combat.playlist');
    const prototypeToken = actor?.prototypeToken;
    const prototypeHasMusic = prototypeToken?.flags?.[CONST.moduleId]?.music?.combat?.playlist;
    const actorHasMusic = actor?.getFlag(CONST.moduleId, 'music.combat.playlist');
    if (token && !token.actorLink) {
      if (tokenHasMusic) return token;
      return actorHasMusic ? actor : null;
    }
    if (token && token.actorLink) {
      if (tokenHasMusic) {
        const useTokenMusic = token.getFlag(CONST.moduleId, 'useTokenMusic');
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
      const defaultConfig = game.settings.get(CONST.moduleId, CONST.settings.defaultMusic);
      if (defaultConfig) {
        const ctx = PlaylistContext.fromDocument(defaultConfig, 'combat', combat);
        if (ctx) contexts.push(ctx);
      }
    }
    for (const section of getRegisteredSections()) {
      for (const source of this._getSectionSources(section.types)) {
        const ctx = PlaylistContext.fromDocument(source, section.contextKey, scene);
        if (ctx) contexts.push(ctx);
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
      const defaultConfig = game.settings.get(CONST.moduleId, CONST.settings.defaultMusic);
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
    if (context === 'area') return game.settings.get(CONST.moduleId, CONST.settings.suppressArea);
    if (context === 'combat') return game.settings.get(CONST.moduleId, CONST.settings.suppressCombat);
    return false;
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
    const silentMode = game.settings.get(CONST.moduleId, CONST.settings.silentCombatMusicMode);
    if (silentMode === CONST.silentModes.lastActor) {
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
    } else if (silentMode === CONST.silentModes.area) {
      if (getEntityTypeName(a.contextEntity) !== 'Actor' && a.context === 'area') return -1;
      if (getEntityTypeName(b.contextEntity) !== 'Actor' && b.context === 'area') return 1;
    } else if (silentMode === CONST.silentModes.generic) {
      if (getEntityTypeName(a.contextEntity) !== 'Actor' && a.context === 'combat') return -1;
      if (getEntityTypeName(b.contextEntity) !== 'Actor' && b.context === 'combat') return 1;
    }
    if (a.priority !== b.priority) return b.priority - a.priority;
    const aTypeName = getEntityTypeName(a.contextEntity);
    const bTypeName = getEntityTypeName(b.contextEntity);
    if (aTypeName !== bTypeName) {
      const priorities = CONST.documentSortPriority;
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
    const filteredContexts = allContexts.filter(this.filterPlaylists.bind(this));
    const sortedContexts = filteredContexts.sort(this.sortPlaylists.bind(this));
    return sortedContexts.length > 0 ? sortedContexts[0] : null;
  }

  /**
   * Play the current track based on context
   * Transitions are serialized, so overlapping callers cannot tear the current context
   * @returns {Promise<void>} Resolves once this transition has run
   */
  async playCurrentTrack() {
    if (!isHeadGM() || !game.ready) return;
    const transition = this.playbackChain.then(async () => {
      const newContext = this.getCurrentPlaylist();
      await this.playMusic(newContext);
    });
    this.playbackChain = transition.catch(() => {});
    return transition;
  }

  /**
   * Get playlist data for a track
   * @param {Document} entity - Entity to get data from
   * @param {string} playlistId - Playlist ID
   * @param {string} trackId - Track ID
   * @returns {object} Playlist data
   */
  getPlaylistData(entity, playlistId, trackId) {
    const data = entity.getFlag(CONST.moduleId, `playlist.${playlistId}.${trackId}`);
    return data || { id: playlistId, trackId, start: 0 };
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
    await entity.setFlag(CONST.moduleId, `playlist.${track.parent.id}.${track.id}`, flagData);
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
    await game.settings.set(CONST.moduleId, CONST.settings.nowPlaying, value);
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
    const prev = this.resolveNowPlaying(this.lastNowPlaying);
    const current = this.resolveNowPlaying(value);
    this.lastNowPlaying = value;
    if (prev === current) return;
    Hooks.callAll('vgmusic.trackChanged', { prev, current, context: value?.context ?? null });
  }
}

/** The module's controller instance */
export const musicController = new MusicController();
