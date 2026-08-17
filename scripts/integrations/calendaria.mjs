import { CONST } from '../config.mjs';
import { isHeadGM } from '../helpers.mjs';
import { musicController } from '../music-controller.mjs';

/** @type {object|null} Suppression token held by this client's widget toggle */
let suppressionToken = null;

/** Insertion points that render a full button rather than an indicator */
const BUTTON_POINTS = new Set(['hud.buttons.left', 'hud.buttons.right']);

/**
 * Get the mirrored now-playing value
 * @returns {object|null} Stored now-playing value
 */
function getMirror() {
  return game.settings.get(CONST.moduleId, CONST.settings.nowPlaying);
}

/**
 * Check whether this client has muted module playback
 * @returns {boolean} True if muted locally
 */
function isMuted() {
  return game.settings.get(CONST.moduleId, CONST.settings.nowPlayingMuted);
}

/**
 * Apply this client's mute state to the playing track, deferring until playback starts
 */
function applyMute() {
  const track = musicController.resolveNowPlaying(getMirror());
  const sound = track?.sound;
  if (!sound) return;
  const volume = isMuted() && !isHeadGM() ? 0 : track.volume;
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
  if (isHeadGM() ? suppressionToken : isMuted()) return 'fas fa-volume-xmark';
  return 'fas fa-music';
}

/**
 * Get the indicator color for the current state
 * @returns {string} CSS color, or an empty string for the theme default
 */
function getColor() {
  if (isHeadGM() ? suppressionToken : isMuted()) return 'rgb(200 80 80)';
  return getMirror() ? 'rgb(110 190 120)' : '';
}

/**
 * Get the indicator tooltip, naming the playing track and the click action
 * @returns {string} Tooltip text
 */
function getTooltip() {
  if (isHeadGM() && suppressionToken) return game.i18n.localize('VGMusic.NowPlaying.Release');
  const track = getMirror()?.name;
  if (!track) return game.i18n.localize('VGMusic.NowPlaying.Nothing');
  const key = isHeadGM() ? 'Suppress' : isMuted() ? 'Unmute' : 'Mute';
  return game.i18n.format(`VGMusic.NowPlaying.${key}`, { track });
}

/**
 * Toggle suppression for the head GM, or local mute for everyone else
 */
async function onClick() {
  if (isHeadGM()) {
    if (suppressionToken) {
      musicController.releaseSuppression(suppressionToken);
      suppressionToken = null;
    } else {
      const context = musicController.currentContext?.context;
      if (!context) return;
      suppressionToken = musicController.requestSuppression(context);
    }
  } else {
    await game.settings.set(CONST.moduleId, CONST.settings.nowPlayingMuted, !isMuted());
    applyMute();
  }
  CALENDARIA.api.refreshWidgets();
}

/**
 * Register the now-playing widget at every configured insertion point
 */
export function registerCalendariaWidget() {
  if (!game.modules.get('calendaria')?.active || !globalThis.CALENDARIA?.api) return;
  const points = game.settings.get(CONST.moduleId, CONST.settings.nowPlayingWidget);
  if (!points.size) return;
  for (const point of points) {
    CALENDARIA.api.registerWidget(CONST.moduleId, {
      id: `now-playing-${point.replaceAll('.', '-')}`,
      type: BUTTON_POINTS.has(point) ? 'button' : 'indicator',
      insertAt: point,
      icon: getIcon,
      color: getColor,
      tooltip: getTooltip,
      onClick
    });
  }
  Hooks.on('vgmusic.trackChanged', () => {
    applyMute();
    CALENDARIA.api.refreshWidgets();
  });
  Hooks.on('updatePlaylistSound', onUpdatePlaylistSound);
  Hooks.on('userConnected', () => {
    applyMute();
    CALENDARIA.api.refreshWidgets();
  });
  game.audio.unlock.then(applyMute);
}
