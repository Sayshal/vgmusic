/**
 * Configuration constants for the VGMusic module
 */
export const CONST = {
  moduleId: 'vgmusic',
  settings: {
    silentCombatMusicMode: 'silentCombatMusicMode',
    defaultMusic: 'defaultMusic',
    suppressedContexts: 'suppressedContexts',
    nowPlaying: 'nowPlaying',
    nowPlayingWidget: 'nowPlayingWidget',
    nowPlayingMuted: 'nowPlayingMuted'
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

/** Document type names a section may declare */
const SECTION_TYPES = ['Scene', 'Actor', 'Token', 'DefaultMusic'];

/** Context keys the built-in sections own, which a registered section may not claim */
const RESERVED_CONTEXTS = ['area', 'combat'];

/**
 * Register a playlist section supplied by another module
 * @param {object} section - Section definition
 * @param {string} section.id - Unique registry id
 * @param {string} section.label - Localization key, used verbatim when it resolves to nothing
 * @param {number} [section.priority] - Default sort priority
 * @param {string[]} [section.types] - Document type names the section applies to
 * @param {Function} [section.predicate] - Activation test, evaluated once per playlist refresh
 * @param {string} [section.contextKey] - Context key used for flags and playback, defaults to the id
 * @returns {object|null} The stored section definition, or null when the definition was rejected
 */
export function registerSection({ id, label, priority = 0, types = [], predicate = null, contextKey = null } = {}) {
  const key = contextKey || id;
  if (!id || typeof id !== 'string') {
    ATLAS.log(2, 'Ignoring a playlist section registered without a string id');
    return null;
  }
  if (registeredSections.has(id)) {
    ATLAS.log(2, `Ignoring playlist section "${id}", that id is already registered`);
    return null;
  }
  if (!Array.isArray(types) || types.some((type) => !SECTION_TYPES.includes(type))) {
    ATLAS.log(2, `Ignoring playlist section "${id}", types must be an array drawn from ${SECTION_TYPES.join(', ')}`);
    return null;
  }
  if (predicate !== null && typeof predicate !== 'function') {
    ATLAS.log(2, `Ignoring playlist section "${id}", predicate must be a function`);
    return null;
  }
  if (RESERVED_CONTEXTS.includes(key)) {
    ATLAS.log(2, `Ignoring playlist section "${id}", the context key "${key}" belongs to a built-in section`);
    return null;
  }
  if (getRegisteredSections().some((section) => section.contextKey === key)) {
    ATLAS.log(2, `Ignoring playlist section "${id}", the context key "${key}" is already claimed`);
    return null;
  }
  const section = { id, label, priority, types, predicate, contextKey: key };
  registeredSections.set(id, section);
  return section;
}

/**
 * Remove a registered section
 * @param {string} id - The id the section was registered under
 * @returns {boolean} True if a section was removed
 */
export function unregisterSection(id) {
  return registeredSections.delete(id);
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
