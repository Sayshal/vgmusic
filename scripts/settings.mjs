import { VGMusicConfig } from './apps/music-config.mjs';
import { HOOKS, KEYBINDS, MODULE, SETTINGS, SILENT_MODES } from './constants.mjs';
import { musicController } from './music-controller.mjs';
import { isContextSuppressed, setContextSuppressed } from './utils.mjs';

const { SetField, StringField } = foundry.data.fields;

/** Calendaria insertion points the now-playing widget can occupy */
const WIDGET_POINT_CHOICES = {
  'hud.indicators': 'VGMUSIC.Settings.NowPlayingWidget.HudIndicators',
  'hud.tray': 'VGMUSIC.Settings.NowPlayingWidget.HudTray',
  'hud.buttons.left': 'VGMUSIC.Settings.NowPlayingWidget.HudButtonsLeft',
  'hud.buttons.right': 'VGMUSIC.Settings.NowPlayingWidget.HudButtonsRight',
  'minical.sidebar': 'VGMUSIC.Settings.NowPlayingWidget.MiniCalSidebar',
  'bigcal.actions': 'ATLAS.Common.CalendarActions'
};

/**
 * Register module settings and configuration menu
 */
export function registerSettings() {
  game.settings.register(MODULE.ID, SETTINGS.SILENT_COMBAT_MUSIC_MODE, {
    name: 'VGMUSIC.Settings.SilentCombatMusicMode.Name',
    hint: 'VGMUSIC.Settings.SilentCombatMusicMode.Hint',
    scope: 'world',
    config: true,
    type: String,
    choices: {
      [SILENT_MODES.HIGHEST_PRIORITY]: 'VGMUSIC.Settings.SilentCombatMusicMode.HighestPriority',
      [SILENT_MODES.LAST_ACTOR]: 'VGMUSIC.Settings.SilentCombatMusicMode.LastActor',
      [SILENT_MODES.AREA]: 'VGMUSIC.Settings.SilentCombatMusicMode.Area',
      [SILENT_MODES.GENERIC]: 'VGMUSIC.Settings.SilentCombatMusicMode.Generic'
    },
    default: SILENT_MODES.HIGHEST_PRIORITY,
    onChange: () => {
      musicController.playCurrentTrack();
    }
  });

  game.settings.registerMenu(MODULE.ID, 'defaultMusicMenu', {
    name: 'VGMUSIC.Settings.DefaultMusic.Name',
    label: 'VGMUSIC.Settings.DefaultMusic.Label',
    hint: 'VGMUSIC.Settings.DefaultMusic.Hint',
    icon: 'fas fa-music',
    type: VGMusicConfig,
    restricted: true
  });

  game.settings.register(MODULE.ID, SETTINGS.DEFAULT_MUSIC, {
    name: 'VGMUSIC.Settings.DefaultMusic.Name',
    scope: 'world',
    config: false,
    type: Object,
    default: { documentName: 'DefaultMusic', data: { [MODULE.ID]: { music: {} } } }
  });

  game.settings.register(MODULE.ID, SETTINGS.NOW_PLAYING, {
    scope: 'world',
    config: false,
    type: Object,
    default: null,
    onChange: (value) => {
      musicController.emitTrackChanged(value);
    }
  });

  game.settings.register(MODULE.ID, SETTINGS.NOW_PLAYING_WIDGET, {
    name: 'VGMUSIC.Settings.NowPlayingWidget.Name',
    hint: 'VGMUSIC.Settings.NowPlayingWidget.Hint',
    scope: 'world',
    config: !!game.modules.get('calendaria')?.active,
    type: new SetField(new StringField({ choices: WIDGET_POINT_CHOICES, blank: false })),
    default: ['hud.indicators'],
    requiresReload: true
  });

  game.settings.register(MODULE.ID, SETTINGS.NOW_PLAYING_MUTED, {
    scope: 'client',
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE.ID, SETTINGS.SUPPRESSED_CONTEXTS, {
    scope: 'world',
    config: false,
    type: new SetField(new StringField({ blank: false })),
    default: [],
    onChange: (value) => {
      musicController.playCurrentTrack();
      Hooks.callAll(HOOKS.SUPPRESSION_CHANGED, value);
    }
  });
}

/**
 * Register keybindings
 */
export function registerKeybindings() {
  game.keybindings.register(MODULE.ID, KEYBINDS.TOGGLE_AREA_MUSIC, {
    name: 'VGMUSIC.Keybindings.ToggleAreaMusic',
    restricted: true,
    onDown: () => toggleAreaMusic()
  });

  game.keybindings.register(MODULE.ID, KEYBINDS.TOGGLE_COMBAT_MUSIC, {
    name: 'VGMUSIC.Keybindings.ToggleCombatMusic',
    restricted: true,
    onDown: () => toggleCombatMusic()
  });
}

/**
 * Toggle area music suppression
 */
async function toggleAreaMusic() {
  await setContextSuppressed('area', !isContextSuppressed('area'));
}

/**
 * Toggle combat music suppression
 */
async function toggleCombatMusic() {
  await setContextSuppressed('combat', !isContextSuppressed('combat'));
}
