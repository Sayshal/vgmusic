import { registerSettings, registerKeybindings } from './settings.mjs';
import { MusicController } from './music-controller.mjs';
import {
  getSceneControlButtons,
  handleCanvasReady,
  handleCreateCombatant,
  handleDeleteCombat,
  handleDeleteCombatant,
  handleReady,
  handleSceneConfigRender,
  handleTokenConfigRender,
  handleUpdateActor,
  handleUpdateCombat,
  handleUpdateScene,
  handleUpdateToken,
  VGMusicConfig
} from './app.mjs';

Hooks.once('init', async () => {
  ATLAS.register('vgmusic', { title: 'Video Game Music', github: 'Sayshal/vgmusic' });
  ATLAS.log(3, 'Initializing Video Game Music module');
  game.vgmusic = { musicController: new MusicController(), VGMusicConfig: VGMusicConfig };
  registerSettings();
  registerKeybindings();
  await loadTemplates(['modules/vgmusic/templates/music-config.hbs']);
});
Hooks.once('ready', handleReady);
Hooks.on('getSceneControlButtons', getSceneControlButtons);
Hooks.on('renderSceneConfig', handleSceneConfigRender);
Hooks.on('updateCombat', handleUpdateCombat);
Hooks.on('deleteCombat', handleDeleteCombat);
Hooks.on('canvasReady', handleCanvasReady);
Hooks.on('updateScene', handleUpdateScene);
Hooks.on('updateActor', handleUpdateActor);
Hooks.on('updateToken', handleUpdateToken);
Hooks.on('createCombatant', handleCreateCombatant);
Hooks.on('deleteCombatant', handleDeleteCombatant);
Hooks.on('renderTokenApplication', handleTokenConfigRender);
