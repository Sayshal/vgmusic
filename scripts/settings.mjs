import { VGMusicConfig } from './app.mjs';
import { CONST } from './config.mjs';
import { musicController } from './music-controller.mjs';

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
  game.settings.register(CONST.moduleId, CONST.settings.silentCombatMusicMode, {
    name: 'VGMusic.Settings.SilentCombatMusicMode.Name',
    hint: 'VGMusic.Settings.SilentCombatMusicMode.Hint',
    scope: 'world',
    config: true,
    type: String,
    choices: {
      [CONST.silentModes.highestPriority]: 'VGMusic.Settings.SilentCombatMusicMode.HighestPriority',
      [CONST.silentModes.lastActor]: 'VGMusic.Settings.SilentCombatMusicMode.LastActor',
      [CONST.silentModes.area]: 'VGMusic.Settings.SilentCombatMusicMode.Area',
      [CONST.silentModes.generic]: 'VGMusic.Settings.SilentCombatMusicMode.Generic'
    },
    default: CONST.silentModes.highestPriority,
    onChange: () => {
      musicController.playCurrentTrack();
    }
  });

  game.settings.registerMenu(CONST.moduleId, 'defaultMusicMenu', {
    name: 'VGMusic.Settings.DefaultMusic.Name',
    label: 'VGMusic.Settings.DefaultMusic.Label',
    hint: 'VGMusic.Settings.DefaultMusic.Hint',
    icon: 'fas fa-music',
    type: VGMusicConfig,
    restricted: true
  });

  game.settings.register(CONST.moduleId, CONST.settings.defaultMusic, {
    name: 'VGMusic.Settings.DefaultMusic.Name',
    scope: 'world',
    config: false,
    type: Object,
    default: { documentName: 'DefaultMusic', data: { vgmusic: { music: {} } } }
  });

  game.settings.register(CONST.moduleId, CONST.settings.nowPlaying, {
    scope: 'world',
    config: false,
    type: Object,
    default: null,
    onChange: (value) => {
      musicController.emitTrackChanged(value);
    }
  });

  game.settings.register(CONST.moduleId, CONST.settings.nowPlayingWidget, {
    name: 'VGMusic.Settings.NowPlayingWidget.Name',
    hint: 'VGMusic.Settings.NowPlayingWidget.Hint',
    scope: 'world',
    config: !!game.modules.get('calendaria')?.active,
    type: new SetField(new StringField({ choices: WIDGET_POINT_CHOICES, blank: false })),
    default: ['hud.indicators'],
    requiresReload: true
  });

  game.settings.register(CONST.moduleId, CONST.settings.nowPlayingMuted, {
    scope: 'client',
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(CONST.moduleId, CONST.settings.suppressArea, {
    name: 'VGMusic.Settings.SuppressArea.Name',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false,
    onChange: () => {
      musicController.playCurrentTrack();
    }
  });

  game.settings.register(CONST.moduleId, CONST.settings.suppressCombat, {
    name: 'VGMusic.Settings.SuppressCombat.Name',
    scope: 'world',
    config: false,
    type: Boolean,
    default: false,
    onChange: () => {
      musicController.playCurrentTrack();
    }
  });
}

/**
 * Register keybindings
 */
export function registerKeybindings() {
  game.keybindings.register(CONST.moduleId, 'toggleAreaMusic', {
    name: 'VGMusic.Keybindings.ToggleAreaMusic',
    onDown: () => toggleAreaMusic()
  });

  game.keybindings.register(CONST.moduleId, 'toggleCombatMusic', {
    name: 'VGMusic.Keybindings.ToggleCombatMusic',
    onDown: () => toggleCombatMusic()
  });
}

/**
 * Toggle area music suppression
 */
async function toggleAreaMusic() {
  const current = game.settings.get(CONST.moduleId, CONST.settings.suppressArea);
  await game.settings.set(CONST.moduleId, CONST.settings.suppressArea, !current);
  ui.controls.initialize();
}

/**
 * Toggle combat music suppression
 */
async function toggleCombatMusic() {
  const current = game.settings.get(CONST.moduleId, CONST.settings.suppressCombat);
  await game.settings.set(CONST.moduleId, CONST.settings.suppressCombat, !current);
  ui.controls.initialize();
}
