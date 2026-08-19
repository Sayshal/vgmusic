import { VGMusicConfig } from './apps/music-config.mjs';
import { MODULE, SETTINGS } from './constants.mjs';
import { registerCalendariaWidget } from './integrations/calendaria.mjs';
import { musicController } from './music-controller.mjs';
import { isContextSuppressed, setContextSuppressed } from './utils.mjs';

/**
 * Add scene control buttons for music suppression
 * @param {object} controls - The scene controls object
 */
function onGetSceneControlButtons(controls) {
  try {
    if (controls.sounds && controls.sounds.tools) {
      controls.sounds.tools['suppress-area-music'] = {
        name: 'suppress-area-music',
        order: 10,
        title: 'VGMUSIC.Controls.SuppressAreaMusic',
        icon: 'fas fa-dungeon',
        toggle: true,
        visible: true,
        active: isContextSuppressed('area'),
        onChange: (_event, active) => setContextSuppressed('area', active)
      };
      controls.sounds.tools['suppress-combat-music'] = {
        name: 'suppress-combat-music',
        order: 11,
        title: 'VGMUSIC.Controls.SuppressCombatMusic',
        icon: 'fas fa-fist-raised',
        toggle: true,
        visible: true,
        active: isContextSuppressed('combat'),
        onChange: (_event, active) => setContextSuppressed('combat', active)
      };
    }
  } catch (error) {
    ATLAS.log(1, 'Error adding scene control buttons:', error);
  }
}

/**
 * Handle scene config render to inject music button
 * @param {object} app - The scene config application
 * @param {HTMLElement} html - The rendered HTML
 */
function onRenderSceneConfig(app, html) {
  try {
    const playlistSoundSelect = html.querySelector('select[name="playlistSound"]');
    if (!playlistSoundSelect) return;
    const existingFormGroup = playlistSoundSelect.closest('.form-group');
    if (!existingFormGroup) return;
    const newFormGroup = document.createElement('div');
    newFormGroup.className = 'form-group';
    const label = document.createElement('label');
    label.textContent = _loc('VGMUSIC.Music');
    const formFields = document.createElement('div');
    formFields.className = 'form-fields';
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = 'vgmusic-scene';
    button.innerHTML = `<i class="fas fa-music"></i> ${_loc('VGMUSIC.ConfigTitle')}`;
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = _loc('VGMUSIC.Settings.DefaultMusic.Hint');
    formFields.appendChild(button);
    newFormGroup.appendChild(label);
    newFormGroup.appendChild(formFields);
    newFormGroup.appendChild(hint);
    existingFormGroup.insertAdjacentElement('afterend', newFormGroup);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      new VGMusicConfig(app.document).render(true);
    });
  } catch (error) {
    ATLAS.log(1, 'Error adding scene config button:', error);
  }
}

/**
 * Handle combat updates to trigger music changes
 * @param {object} combat - The combat document
 * @param {object} updateData - The update data
 */
function onUpdateCombat(combat, updateData) {
  if (combat.started && (updateData.turn != null || updateData.round != null)) musicController.playCurrentTrack();
}

/** Handle combat deletion to stop music */
function onDeleteCombat() {
  musicController.playCurrentTrack();
}

/**
 * Handle combatant creation to refresh music
 * @param {object} combatant - The created combatant
 */
function onCreateCombatant(combatant) {
  if (combatant.parent?.started) musicController.playCurrentTrack();
}

/**
 * Handle combatant deletion to refresh music
 * @param {object} combatant - The deleted combatant
 */
function onDeleteCombatant(combatant) {
  if (combatant.parent?.started) musicController.playCurrentTrack();
}

/** Handle canvas ready to start music */
function onCanvasReady() {
  musicController.playCurrentTrack();
}

/**
 * Handle scene updates for music flag changes
 * @param {object} _scene - The scene document
 * @param {object} updateData - The update data
 */
function onUpdateScene(_scene, updateData) {
  if (updateData.flags?.[MODULE.ID]?.music) musicController.playCurrentTrack();
  if ('active' in updateData) musicController.playCurrentTrack();
}

/**
 * Handle actor updates for music flag changes
 * @param {object} _actor - The actor document
 * @param {object} updateData - The update data
 */
function onUpdateActor(_actor, updateData) {
  if (updateData.flags?.[MODULE.ID]?.music) musicController.playCurrentTrack();
}

/**
 * Handle token updates for music flag changes
 * @param {Document} _token - The token document
 * @param {object} updateData - The update data
 */
function onUpdateToken(_token, updateData) {
  if (updateData.flags?.[MODULE.ID]?.music) musicController.playCurrentTrack();
}

/**
 * Handle TokenConfig render to inject music configuration
 * @param {object} app - The application
 * @param {HTMLElement} html - The rendered HTML
 * @param {object} _context - Render context
 * @param {object} _options - Render options
 */
function onRenderTokenApplication(app, html, _context, _options) {
  try {
    if (!game.user.isGM) return;
    const identityTab = html.querySelector('[data-application-part="identity"]') || html.querySelector('[data-tab="identity"].tab') || html.querySelector('.tab[data-tab="identity"]');
    if (!identityTab) return;
    const nameField = identityTab.querySelector('.form-group');
    if (!nameField) return;
    const isPrototype = app.constructor.name.includes('Prototype');
    const token = isPrototype ? app.actor?.prototypeToken : app.token;
    if (!token) return;
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    const label = document.createElement('label');
    label.textContent = _loc('VGMUSIC.Music');
    const formFields = document.createElement('div');
    formFields.className = 'form-fields';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vgmusic-token-config';
    button.innerHTML = `<i class="fas fa-music"></i> ${_loc('VGMUSIC.ConfigTitle')}`;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      new VGMusicConfig(token).render(true);
    });
    formFields.appendChild(button);
    formGroup.appendChild(label);
    formGroup.appendChild(formFields);
    nameField.insertAdjacentElement('afterend', formGroup);
    const isLinked = token.actorLink ?? false;
    if (isLinked && !isPrototype) {
      const useTokenMusic = token.getFlag?.(MODULE.ID, 'useTokenMusic') ?? false;
      const checkboxGroup = document.createElement('div');
      checkboxGroup.className = 'form-group';
      const checkLabel = document.createElement('label');
      checkLabel.textContent = _loc('VGMUSIC.UseTokenMusic.Label');
      const checkFields = document.createElement('div');
      checkFields.className = 'form-fields';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = `flags.${MODULE.ID}.useTokenMusic`;
      checkbox.checked = useTokenMusic;
      checkFields.appendChild(checkbox);
      checkboxGroup.appendChild(checkLabel);
      checkboxGroup.appendChild(checkFields);
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = _loc('VGMUSIC.UseTokenMusic.Hint');
      checkboxGroup.appendChild(hint);
      formGroup.insertAdjacentElement('afterend', checkboxGroup);
    }
  } catch (error) {
    ATLAS.log(1, 'Error adding token config button:', error);
  }
}

/** Handle a user connecting or disconnecting, which can move head-GM status to this client */
function onUserConnected() {
  musicController.playCurrentTrack();
}

/** Handle game ready to start music after delay */
export async function onReady() {
  musicController.lastNowPlaying = game.settings.get(MODULE.ID, SETTINGS.NOW_PLAYING);
  registerCalendariaWidget();
  setTimeout(() => {
    musicController.playCurrentTrack();
  }, 1000);
}

/**
 * Add a music configuration entry to the scene navigation and sidebar context menus
 * @param {object} _application - The application whose menu is being built
 * @param {object[]} options - Context menu entries, mutated in place
 */
function onGetSceneContextOptions(_application, options) {
  options.push({
    label: 'VGMUSIC.ConfigTitle',
    icon: 'fas fa-music',
    onClick: (_event, li) => {
      const scene = game.scenes.get(li.dataset.sceneId ?? li.dataset.entryId);
      if (scene) new VGMusicConfig(scene).render(true);
    }
  });
}

/**
 * Wire the module's global hooks.
 * @returns {void}
 */
export function registerHooks() {
  Hooks.on('getSceneContextOptions', onGetSceneContextOptions);
  Hooks.on('getSceneControlButtons', onGetSceneControlButtons);
  Hooks.on('renderSceneConfig', onRenderSceneConfig);
  Hooks.on('updateCombat', onUpdateCombat);
  Hooks.on('deleteCombat', onDeleteCombat);
  Hooks.on('canvasReady', onCanvasReady);
  Hooks.on('updateScene', onUpdateScene);
  Hooks.on('updateActor', onUpdateActor);
  Hooks.on('updateToken', onUpdateToken);
  Hooks.on('createCombatant', onCreateCombatant);
  Hooks.on('deleteCombatant', onDeleteCombatant);
  Hooks.on('renderTokenApplication', onRenderTokenApplication);
  Hooks.on('userConnected', onUserConnected);
}
