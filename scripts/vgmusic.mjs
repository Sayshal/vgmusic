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
import { registerSection } from './config.mjs';
import { PlaylistContext } from './helpers.mjs';
import { musicController } from './music-controller.mjs';
import { registerKeybindings, registerSettings } from './settings.mjs';

Hooks.once('init', async () => {
  ATLAS.register('vgmusic', { title: 'Video Game Music', github: 'Sayshal/vgmusic' });
  ATLAS.log(3, 'Initializing Video Game Music module');
  globalThis.VGMUSIC = {
    musicController,
    VGMusicConfig: VGMusicConfig,
    PlaylistContext,
    registerSection,
    requestSuppression: (context) => musicController.requestSuppression(context),
    releaseSuppression: (token) => musicController.releaseSuppression(token)
  };
  registerSettings();
  registerKeybindings();
  await foundry.applications.handlebars.loadTemplates(['modules/vgmusic/templates/music-config.hbs']);
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
