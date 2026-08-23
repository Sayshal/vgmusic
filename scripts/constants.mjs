/** @type {object} Module identifiers. */
export const MODULE = { ID: 'vgmusic', TITLE: 'Video Game Music' };

/** @enum {string} Setting keys. */
export const SETTINGS = {
  SILENT_COMBAT_MUSIC_MODE: 'silentCombatMusicMode',
  DEFAULT_MUSIC: 'defaultMusic',
  SUPPRESSED_CONTEXTS: 'suppressedContexts',
  NOW_PLAYING: 'nowPlaying',
  NOW_PLAYING_WIDGET: 'nowPlayingWidget',
  NOW_PLAYING_MUTED: 'nowPlayingMuted'
};

/** @enum {string} Keybinding action ids. */
export const KEYBINDS = { TOGGLE_AREA_MUSIC: 'toggleAreaMusic', TOGGLE_COMBAT_MUSIC: 'toggleCombatMusic' };

/** @enum {string} Silent-combat-music resolution modes. */
export const SILENT_MODES = { HIGHEST_PRIORITY: 'highestPriority', LAST_ACTOR: 'lastActor', AREA: 'area', GENERIC: 'generic' };

/** @enum {string} Hooks this module fires for consumers. */
export const HOOKS = { TRACK_CHANGED: 'vgmusic.trackChanged', SUPPRESSION_CHANGED: 'vgmusic.suppressionChanged' };

/** @type {object} Built-in playlist sections, keyed by document type name. */
export const PLAYLIST_SECTIONS = {
  DefaultMusic: { combat: { label: 'VGMUSIC.PlaylistSection.Combat', priority: -5, hint: 'VGMUSIC.PlaylistSection.Hint.DefaultCombat' } },
  Scene: {
    area: { label: 'VGMUSIC.PlaylistSection.Area', priority: -20, hint: 'VGMUSIC.PlaylistSection.Hint.SceneArea' },
    combat: { label: 'VGMUSIC.PlaylistSection.Combat', priority: -10, hint: 'VGMUSIC.PlaylistSection.Hint.SceneCombat' }
  },
  Actor: { combat: { label: 'VGMUSIC.PlaylistSection.Combat', priority: 0, hint: 'VGMUSIC.PlaylistSection.Hint.ActorCombat' } },
  Token: { combat: { label: 'VGMUSIC.PlaylistSection.Combat', priority: 5, hint: 'VGMUSIC.PlaylistSection.Hint.TokenCombat' } }
};

/** @type {string[]} Document type names in ascending playback precedence, the final sort tiebreak. */
export const DOCUMENT_SORT_PRIORITY = ['Token', 'Actor', 'Scene', 'DefaultMusic'];

/** @enum {string} Handlebars template paths. */
export const TEMPLATES = {
  MUSIC_CONFIG: 'modules/vgmusic/templates/music-config.hbs',
  SECTION_CONFIG: 'modules/vgmusic/templates/section-config.hbs'
};
