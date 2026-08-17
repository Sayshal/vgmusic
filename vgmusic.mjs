import { exposeApi } from './scripts/api.mjs';
import { MODULE } from './scripts/constants.mjs';
import { onReady, registerHooks } from './scripts/hooks.mjs';
import { registerKeybindings, registerSettings } from './scripts/settings.mjs';
import './styles/vgmusic.css';

Hooks.once('init', () => {
  ATLAS.register(MODULE.ID, { title: MODULE.TITLE, github: 'Sayshal/vgmusic' });
  ATLAS.log(3, 'Initializing module');
  registerSettings();
  registerKeybindings();
  registerHooks();
  exposeApi();
});

Hooks.once('ready', onReady);
