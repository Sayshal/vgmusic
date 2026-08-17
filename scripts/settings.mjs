import { VGMusicConfig } from './apps/music-config.mjs';
import { HOOKS, KEYBINDS, MODULE, SETTINGS, SILENT_MODES } from './constants.mjs';
import { musicController } from './music-controller.mjs';
import { isContextSuppressed, setContextSuppressed } from './utils.mjs';

const { SetField, StringField } = foundry.data.fields;

/** Calendaria insertion points the now-playing widget can occupy */
const WIDGET_POINT_CHOICES = {
  'hud.indicators': 'VGMusic.Settings.NowPlayingWidget.HudIndicators',
  'hud.tray': 'VGMusic.Settings.NowPlayingWidget.HudTray',
  'hud.buttons.left': 'VGMusic.Settings.NowPlayingWidget.HudButtonsLeft',
  'hud.buttons.right': 'VGMusic.Settings.NowPlayingWidget.HudButtonsRight',
  'minical.sidebar': 'VGMusic.Settings.NowPlayingWidget.MiniCalSidebar',
  'bigcal.actions': 'VGMusic.Settings.NowPlayingWidget.BigCalActions'
};

/**
 * Register module settings and configuration menu
 */
export function registerSettings() {
  game.settings.register(MODULE.ID, SETTINGS.SILENT_COMBAT_MUSIC_MODE, {
    name: 'VGMusic.Settings.SilentCombatMusicMode.Name',
    hint: 'VGMusic.Settings.SilentCombatMusicMode.Hint',
    scope: 'world',
    config: true,
    type: String,
    choices: {
      [SILENT_MODES.HIGHEST_PRIORITY]: 'VGMusic.Settings.SilentCombatMusicMode.HighestPriority',
      [SILENT_MODES.LAST_ACTOR]: 'VGMusic.Settings.SilentCombatMusicMode.LastActor',
      [SILENT_MODES.AREA]: 'VGMusic.Settings.SilentCombatMusicMode.Area',
      [SILENT_MODES.GENERIC]: 'VGMusic.Settings.SilentCombatMusicMode.Generic'
    },
    default: SILENT_MODES.HIGHEST_PRIORITY,
    onChange: () => {
      musicController.playCurrentTrack();
    }
  });

  game.settings.registerMenu(MODULE.ID, 'defaultMusicMenu', {
    name: 'VGMusic.Settings.DefaultMusic.Name',
    label: 'VGMusic.Settings.DefaultMusic.Label',
    hint: 'VGMusic.Settings.DefaultMusic.Hint',
    icon: 'fas fa-music',
    type: VGMusicConfig,
    restricted: true
  });

  game.settings.register(MODULE.ID, SETTINGS.DEFAULT_MUSIC, {
    name: 'VGMusic.Settings.DefaultMusic.Name',
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
    name: 'VGMusic.Settings.NowPlayingWidget.Name',
    hint: 'VGMusic.Settings.NowPlayingWidget.Hint',
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
    name: 'VGMusic.Keybindings.ToggleAreaMusic',
    restricted: true,
    onDown: () => toggleAreaMusic()
  });

  game.keybindings.register(MODULE.ID, KEYBINDS.TOGGLE_COMBAT_MUSIC, {
    name: 'VGMusic.Keybindings.ToggleCombatMusic',
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
