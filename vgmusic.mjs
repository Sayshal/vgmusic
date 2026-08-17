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
  handleUserConnected,
  VGMusicConfig
} from './scripts/app.mjs';
import { getRegisteredSections, registerSection, unregisterSection } from './scripts/config.mjs';
import { PlaylistContext } from './scripts/helpers.mjs';
import { musicController } from './scripts/music-controller.mjs';
import { registerKeybindings, registerSettings } from './scripts/settings.mjs';
import './styles/vgmusic.css';

/**
 * Register a playlist section and hand back a handle for its lifetime
 * @param {object} definition - Section definition, see registerSection
 * @returns {object|null} Handle exposing unregister and refresh, or null when the definition was rejected
 */
function registerSectionHandle(definition) {
  const section = registerSection(definition);
  if (!section) return null;
  musicController.playCurrentTrack();
  return {
    id: section.id,
    contextKey: section.contextKey,
    unregister: () => {
      unregisterSection(section.id);
      musicController.playCurrentTrack();
    },
    refresh: () => musicController.playCurrentTrack()
  };
}

Hooks.once('init', async () => {
  ATLAS.register('vgmusic', { title: 'Video Game Music', github: 'Sayshal/vgmusic' });
  ATLAS.log(3, 'Initializing Video Game Music module');
  globalThis.VGMUSIC = {
    musicController,
    VGMusicConfig: VGMusicConfig,
    PlaylistContext,
    registerSection: registerSectionHandle,
    unregisterSection,
    getRegisteredSections,
    refreshSections: () => musicController.playCurrentTrack(),
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
Hooks.on('userConnected', handleUserConnected);
