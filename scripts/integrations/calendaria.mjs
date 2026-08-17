import { HOOKS, MODULE, SETTINGS } from '../constants.mjs';
import { musicController } from '../music-controller.mjs';
import { isContextSuppressed, setContextSuppressed } from '../utils.mjs';

/** Insertion points that render a full button rather than an indicator */
const BUTTON_POINTS = new Set(['hud.buttons.left', 'hud.buttons.right']);

/** Longest track name the indicator shows before trimming */
const LABEL_LENGTH = 24;

/**
 * Get the context the widget acts on, preferring the head GM's live state over the mirror
 * @returns {string|null} Context key, or null when nothing is playing
 */
function currentContext() {
  return musicController.currentContext?.context ?? getMirror()?.context ?? null;
}

/**
 * Check whether the context the widget acts on is suppressed
 * @returns {boolean} True if the GM has suppressed it
 */
function isSuppressed() {
  const context = currentContext();
  return !!context && isContextSuppressed(context);
}

/**
 * Get the mirrored now-playing value
 * @returns {object|null} Stored now-playing value
 */
function getMirror() {
  return game.settings.get(MODULE.ID, SETTINGS.NOW_PLAYING);
}

/**
 * Check whether this client has muted module playback
 * @returns {boolean} True if muted locally
 */
function isMuted() {
  return game.settings.get(MODULE.ID, SETTINGS.NOW_PLAYING_MUTED);
}

/**
 * Apply this client's mute state to the playing track, deferring until playback starts
 */
function applyMute() {
  const track = musicController.resolveNowPlaying(getMirror());
  const sound = track?.sound;
  if (!sound) return;
  const volume = isMuted() && !game.user.isGM ? 0 : track.volume;
  if (sound.playing) sound.volume = volume;
  else sound.addEventListener('play', () => (sound.volume = volume), { once: true });
}

/**
 * Re-apply the mute whenever core re-syncs the mirrored track's volume
 * @param {Document} sound - The updated PlaylistSound
 */
function onUpdatePlaylistSound(sound) {
  if (sound.id === getMirror()?.trackId) applyMute();
}

/**
 * Get the indicator icon for the current state
 * @returns {string} Icon classes
 */
function getIcon() {
  if (game.user.isGM ? isSuppressed() : isMuted()) return 'fas fa-volume-xmark';
  return 'fas fa-music';
}

/**
 * Get the indicator color for the current state
 * @returns {string} CSS color, or an empty string for the theme default
 */
function getColor() {
  if (game.user.isGM ? isSuppressed() : isMuted()) return 'rgb(200 80 80)';
  return getMirror() ? 'rgb(110 190 120)' : '';
}

/**
 * Get the indicator label, naming the playing track
 * @returns {string} Track name, trimmed and escaped, or an empty string when nothing is playing
 */
function getLabel() {
  const name = getMirror()?.name;
  if (!name) return '';
  const trimmed = name.length > LABEL_LENGTH ? `${name.slice(0, LABEL_LENGTH - 1)}…` : name;
  return foundry.utils.escapeHTML(trimmed);
}

/**
 * Get the indicator tooltip, naming the playing track and the click action
 * @returns {string} Tooltip text
 */
function getTooltip() {
  if (game.user.isGM && isSuppressed()) return game.i18n.localize('VGMusic.NowPlaying.Release');
  const name = getMirror()?.name;
  if (!name) return game.i18n.localize('VGMusic.NowPlaying.Nothing');
  const key = game.user.isGM ? 'Suppress' : isMuted() ? 'Unmute' : 'Mute';
  return game.i18n.format(`VGMusic.NowPlaying.${key}`, { track: foundry.utils.escapeHTML(name) });
}

/** Suppress the playing context for every client as a GM, or mute locally as a player */
async function onClick() {
  if (game.user.isGM) {
    const context = currentContext();
    if (!context) return;
    await setContextSuppressed(context, !isContextSuppressed(context));
  } else {
    await game.settings.set(MODULE.ID, SETTINGS.NOW_PLAYING_MUTED, !isMuted());
    applyMute();
  }
  CALENDARIA.api.refreshWidgets();
}

/** Register the now-playing widget at every configured insertion point */
export function registerCalendariaWidget() {
  if (!game.modules.get('calendaria')?.active || !globalThis.CALENDARIA?.api) return;
  const points = game.settings.get(MODULE.ID, SETTINGS.NOW_PLAYING_WIDGET);
  if (!points.size) return;
  for (const point of points) {
    CALENDARIA.api.registerWidget(MODULE.ID, {
      id: `now-playing-${point.replaceAll('.', '-')}`,
      type: BUTTON_POINTS.has(point) ? 'button' : 'indicator',
      insertAt: point,
      icon: getIcon,
      label: getLabel,
      color: getColor,
      tooltip: getTooltip,
      onClick
    });
  }
  Hooks.on(HOOKS.TRACK_CHANGED, () => {
    applyMute();
    CALENDARIA.api.refreshWidgets();
  });
  Hooks.on('updatePlaylistSound', onUpdatePlaylistSound);
  Hooks.on('userConnected', () => {
    applyMute();
    CALENDARIA.api.refreshWidgets();
  });
  Hooks.on(HOOKS.SUPPRESSION_CHANGED, () => CALENDARIA.api.refreshWidgets());
  game.audio.unlock.then(applyMute);
}
