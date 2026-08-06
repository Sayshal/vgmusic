/**
 * Configuration constants for the VGMusic module
 */
export const CONST = {
  moduleId: 'vgmusic',
  settings: {
    silentCombatMusicMode: 'silentCombatMusicMode',
    defaultMusic: 'defaultMusic',
    suppressArea: 'suppressArea',
    suppressCombat: 'suppressCombat',
    fadeDuration: 'fadeDuration',
    nowPlaying: 'nowPlaying'
  },
  silentModes: { highestPriority: 'highestPriority', lastActor: 'lastActor', area: 'area', generic: 'generic' },
  playlistSections: {
    DefaultMusic: { combat: { label: 'VGMusic.PlaylistSection.Combat', priority: -5 } },
    Scene: { area: { label: 'VGMusic.PlaylistSection.Area', priority: -20 }, combat: { label: 'VGMusic.PlaylistSection.Combat', priority: -10 } },
    Actor: { combat: { label: 'VGMusic.PlaylistSection.Combat', priority: 0 } },
    Token: { combat: { label: 'VGMusic.PlaylistSection.Combat', priority: 5 } }
  },
  documentSortPriority: ['Token', 'Actor', 'Scene', 'DefaultMusic']
};

const registeredSections = new Map();

/**
 * Register a playlist section supplied by another module
 * @param {object} section - Section definition
 * @param {string} section.id - Unique registry id
 * @param {string} section.label - Localization key, used verbatim when it resolves to nothing
 * @param {number} [section.priority] - Default sort priority
 * @param {string[]} [section.types] - Document type names the section applies to
 * @param {Function} [section.predicate] - Activation test, evaluated once per playlist refresh
 * @param {string} [section.contextKey] - Context key used for flags and playback, defaults to the id
 * @returns {object} The stored section definition
 */
export function registerSection({ id, label, priority = 0, types = [], predicate = null, contextKey = null } = {}) {
  const section = { id, label, priority, types, predicate, contextKey: contextKey || id };
  registeredSections.set(id, section);
  return section;
}

/**
 * Get every registered section definition
 * @returns {object[]} Registered sections
 */
export function getRegisteredSections() {
  return [...registeredSections.values()];
}

/**
 * Get the section table for a document type, built-ins merged with registered sections
 * @param {string} docType - Document type name
 * @returns {object|undefined} Sections keyed by context, or undefined when the type has none
 */
export function getSections(docType) {
  const builtin = CONST.playlistSections[docType];
  const registered = getRegisteredSections().filter((section) => section.types.includes(docType));
  const sections = { ...builtin };
  for (const section of registered) sections[section.contextKey] = { label: section.label, priority: section.priority };
  return Object.keys(sections).length ? sections : undefined;
}
