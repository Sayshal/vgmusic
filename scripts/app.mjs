import { CONST } from './config.mjs';
import { getProperty } from './helpers.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { DragDrop } = foundry.applications.ux;

/**
 * Music configuration application
 */
export class VGMusicConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'vgmusic-config',
    tag: 'form',
    window: { title: 'VGMusic.ConfigTitle', icon: 'fas fa-music', resizable: true, minimizable: true },
    modal: true,
    classes: ['dnd5e2'],
    form: {
      handler: VGMusicConfig.formHandler,
      closeOnSubmit: false,
      submitOnChange: false
    },
    position: { width: 'auto', height: 'auto' },
    actions: {
      reset: VGMusicConfig.handleReset,
      openPlaylist: VGMusicConfig.openPlaylist,
      deletePlaylist: VGMusicConfig.deletePlaylist
    },
    dragDrop: [
      { dragSelector: '.playlist-section-item[data-reorderable="true"]', dropSelector: '.playlist-section-list', permissions: { dragstart: true, drop: true }, callbacks: {} },
      { dragSelector: null, dropSelector: '.playlist-section[data-section]', permissions: { dragstart: false, drop: true }, callbacks: {} }
    ]
  };

  /** @override */
  static PARTS = { form: { template: 'modules/vgmusic/templates/music-config.hbs' } };

  config = [];

  /**
   * Create a new configuration instance
   * @param {object} object The document object to configure
   * @param {object} [options] Additional application options
   */
  constructor(object, options = {}) {
    super(options);
    this.document = object || game.settings.get(CONST.moduleId, CONST.settings.defaultMusic);
  }

  /**
   * Get the update data prefix based on document type
   * @returns {string} The prefix path for flag updates
   */
  get updateDataPrefix() {
    if (this.isDocument || this.document.constructor.name === 'PrototypeToken') return 'flags.vgmusic';
    return 'data.vgmusic';
  }

  /**
   * Check if the configured object is a Document
   * @returns {boolean} True if document instance
   */
  get isDocument() {
    return this.document instanceof foundry.abstract.Document;
  }

  /**
   * Get the document type name for playlist sections lookup
   * Handles both Documents and DataModels (like PrototypeToken)
   * @returns {string|undefined} The document type name
   */
  get documentTypeName() {
    if (this.document.documentName) return this.document.documentName;
    if (this.document.constructor.name === 'PrototypeToken') return 'Token';
    return undefined;
  }

  /**
   * Initialize the playlist configuration from document or defaults
   */
  initializeConfig() {
    try {
      const docType = this.documentTypeName;
      const sections = CONST.playlistSections[docType];
      if (!sections) {
        ATLAS.log(1, 'No sections found for document type:', docType);
        this.config = [];
        return;
      }
      const data = getProperty(this.document, this.updateDataPrefix) || {};
      this.config = Object.entries(sections).map(([key, sectionConfig]) => {
        const sectionData = getProperty(data, `music.${key}`) || {};
        const playlistId = sectionData.playlist;
        const playlist = playlistId ? game.playlists.get(playlistId) : null;
        const tracks =
          playlist?.playbackOrder?.reduce((obj, id) => {
            const track = playlist.sounds.get(id);
            obj[id] = track.name;
            return obj;
          }, {}) || {};
        return {
          id: key,
          label: sectionConfig.label,
          order: sectionData.order || sectionConfig.priority || 0,
          enabled: !!playlist,
          playlist,
          tracks,
          data: sectionData,
          allowPriority: true,
          sortable: true
        };
      });
      this.config.sort((a, b) => a.order - b.order);
    } catch (error) {
      ATLAS.log(1, 'Error initializing configuration:', error);
      this.config = [];
    }
  }

  /** @override */
  _prepareContext(_options) {
    this.initializeConfig();
    const playlistConfig = this.config.map((section, index) => ({ ...section, index, labelLocalized: _loc(section.label) }));
    const buttons = [
      { type: 'submit', icon: 'fas fa-save', label: 'VGMusic.UI.Save' },
      { type: 'button', action: 'reset', icon: 'fas fa-undo', label: 'VGMusic.UI.Reset' }
    ];
    return { playlistConfig, buttons, documentType: this.documentTypeName };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.setDraggableAttributes();
    this.setupDragDrop();
  }

  /**
   * Set up drag and drop handlers for both reordering and external drops
   */
  setupDragDrop() {
    this.options.dragDrop.forEach((dragDropOptions, index) => {
      if (index === 0) {
        dragDropOptions.callbacks = {
          dragstart: this.onDragStart.bind(this),
          dragover: this.onDragOver.bind(this),
          drop: this.onDropReorder.bind(this)
        };
      } else {
        dragDropOptions.callbacks = {
          dragover: this.onDragOverExternal.bind(this),
          drop: this.onDropExternal.bind(this)
        };
      }
      const dragDropHandler = new DragDrop(dragDropOptions);
      dragDropHandler.bind(this.element);
    });
  }

  /**
   * Set draggable attributes on playlist items
   */
  setDraggableAttributes() {
    const items = this.element.querySelectorAll('.playlist-section-item');
    items.forEach((item, index) => {
      const section = this.config[index];
      const isSortable = section?.sortable !== false;
      item.setAttribute('draggable', isSortable ? 'true' : 'false');
      item.setAttribute('data-reorderable', isSortable ? 'true' : 'false');
    });
  }

  /**
   * Handle drag start event for internal reordering
   * @param {DragEvent} event - The drag event
   * @returns {boolean} Whether drag started successfully
   */
  onDragStart(event) {
    try {
      const li = event.currentTarget.closest('li');
      if (!li || li.classList.contains('not-sortable')) {
        ATLAS.log(1, 'Drag start blocked - not sortable');
        return false;
      }
      this._formState = this._captureFormState();
      const sectionIndex = li.dataset.index;
      const dragData = { type: 'playlist-config-reorder', index: sectionIndex };
      event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
      li.classList.add('dragging');
      return true;
    } catch (error) {
      ATLAS.log(1, 'Error starting drag:', error);
      return false;
    }
  }

  /**
   * Handle drag over event for internal reordering
   * @param {DragEvent} event - The drag event
   */
  onDragOver(event) {
    event.preventDefault();
    const list = this.element.querySelector('.playlist-section-list');
    if (!list) {
      ATLAS.log(2, 'No playlist section list found');
      return;
    }
    const draggingItem = list.querySelector('.dragging');
    if (!draggingItem) return;
    const items = Array.from(list.querySelectorAll('li:not(.dragging)'));
    if (!items.length) return;
    const targetItem = this.getDragTarget(event, items);
    if (!targetItem) return;
    const rect = targetItem.getBoundingClientRect();
    const dropAfter = event.clientY > rect.top + rect.height / 2;
    this.removeDropPlaceholders();
    this.createDropPlaceholder(targetItem, dropAfter);
  }

  /**
   * Handle drag over event for external drops
   * @param {DragEvent} event - The drag event
   */
  onDragOverExternal(event) {
    event.preventDefault();
    const hasExternalData = event.dataTransfer.types.includes('text/plain');
    if (hasExternalData) event.currentTarget.classList.add('drop-hover');
  }

  /**
   * Find the target element for dropping
   * @param {DragEvent} event - The drag event
   * @param {HTMLElement[]} items - List of potential drop targets
   * @returns {HTMLElement|null} The closest drop target element
   */
  getDragTarget(event, items) {
    try {
      return (
        items.reduce((closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = event.clientY - (box.top + box.height / 2);
          if (closest === null || Math.abs(offset) < Math.abs(closest.offset)) return { element: child, offset: offset };
          else return closest;
        }, null)?.element || null
      );
    } catch (error) {
      ATLAS.log(1, 'Error finding drag target:', error);
      return null;
    }
  }

  /**
   * Handle drop event for internal reordering
   * @param {DragEvent} event - The drop event
   * @returns {Promise<boolean>} Whether drop was handled successfully
   */
  async onDropReorder(event) {
    try {
      event.preventDefault();
      const dataString = event.dataTransfer.getData('text/plain');
      if (!dataString) return false;
      const data = JSON.parse(dataString);
      if (!data || data.type !== 'playlist-config-reorder') return false;
      const sourceIndex = parseInt(data.index);
      if (isNaN(sourceIndex)) return false;
      const list = this.element.querySelector('.playlist-section-list');
      const items = Array.from(list.querySelectorAll('li:not(.dragging)'));
      const targetItem = this.getDragTarget(event, items);
      if (!targetItem) return false;
      const targetIndex = parseInt(targetItem.dataset.index);
      if (isNaN(targetIndex)) return false;
      const rect = targetItem.getBoundingClientRect();
      const dropAfter = event.clientY > rect.top + rect.height / 2;
      let newIndex = dropAfter ? targetIndex + 1 : targetIndex;
      if (sourceIndex < newIndex) newIndex--;
      const [movedItem] = this.config.splice(sourceIndex, 1);
      this.config.splice(newIndex, 0, movedItem);
      this.updatePlaylistOrder();
      if (this._formState) for (const section of this.config) if (section.id in this._formState) section.enabled = this._formState[section.id];
      this.render(false);
      return true;
    } catch (error) {
      ATLAS.log(1, 'Error handling reorder drop:', error);
      return false;
    } finally {
      this.cleanupDragElements();
      delete this._formState;
    }
  }

  /**
   * Handle drop event for external playlist/sound drops
   * @param {DragEvent} event - The drop event
   * @returns {Promise<boolean>} Whether drop was handled successfully
   */
  async onDropExternal(event) {
    try {
      event.preventDefault();
      event.currentTarget.classList.remove('drop-hover');
      const dataString = event.dataTransfer.getData('text/plain');
      if (!dataString) return false;
      let data;
      try {
        data = JSON.parse(dataString);
      } catch (e) {
        ATLAS.log(1, 'Failed to parse drag data:', e);
        return false;
      }
      if (data.type === 'playlist-config-reorder') return false;
      if (!['Playlist', 'PlaylistSound'].includes(data.type) || !data.uuid) return false;
      const section = event.currentTarget.dataset.section;
      if (!section) return false;
      const document = await fromUuid(data.uuid);
      if (!document) return false;
      let playlist, sound;
      if (document instanceof PlaylistSound) {
        playlist = document.parent;
        sound = document;
      } else if (document instanceof Playlist) playlist = document;
      else return false;
      const sectionConfig = CONST.playlistSections[this.documentTypeName][section];
      if (!sectionConfig) return false;
      const updateData = { [`music.${section}.playlist`]: playlist.id, [`music.${section}.initialTrack`]: sound?.id || '' };
      const currentData = getProperty(this.document, this.updateDataPrefix) || {};
      const prevData = getProperty(currentData, `music.${section}`);
      if (!prevData?.priority) updateData[`music.${section}.priority`] = sectionConfig.priority;
      await this.updateObject(updateData);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update playlist order values after reordering
   */
  updatePlaylistOrder() {
    this.config.forEach((section, idx) => {
      section.order = (idx + 1) * 10;
    });
  }

  /**
   * Create a visual placeholder for drop position
   * @param {HTMLElement} targetItem - The target element to place placeholder near
   * @param {boolean} dropAfter - Whether to place placeholder after target
   */
  createDropPlaceholder(targetItem, dropAfter) {
    const placeholder = document.createElement('div');
    placeholder.classList.add('drop-placeholder');
    if (dropAfter) targetItem.after(placeholder);
    else targetItem.before(placeholder);
  }

  /**
   * Remove all drop placeholders
   */
  removeDropPlaceholders() {
    const placeholders = this.element.querySelectorAll('.drop-placeholder');
    placeholders.forEach((el) => el.remove());
  }

  /**
   * Clean up visual elements after dragging
   */
  cleanupDragElements() {
    const draggingItems = this.element.querySelectorAll('.dragging');
    draggingItems.forEach((el) => el.classList.remove('dragging'));
    this.removeDropPlaceholders();
    const dropHoverItems = this.element.querySelectorAll('.drop-hover');
    dropHoverItems.forEach((el) => el.classList.remove('drop-hover'));
  }

  /**
   * Capture current form state for playlist enablement
   * @returns {object} Form state object
   */
  _captureFormState() {
    const state = {};
    const checkboxes = this.element.querySelectorAll('input[type="checkbox"][name^="enabled-"]');
    checkboxes.forEach((checkbox) => {
      const sectionId = checkbox.name.replace('enabled-', '');
      state[sectionId] = checkbox.checked;
    });
    return state;
  }

  /**
   * Update the document with new data
   * @param {object} data - The data to update
   * @returns {Promise<void>} Resolves when update completes
   */
  async updateObject(data) {
    const expandedData = Object.entries(data).reduce((acc, [key, value]) => {
      acc[`${this.updateDataPrefix}.${key}`] = value;
      return acc;
    }, {});
    if (this.isDocument) {
      const result = await this.document.update(expandedData);
      this.render(false);
      return result;
    }
    if (this.document.constructor.name === 'PrototypeToken') {
      const actor = this.document.parent;
      if (!actor) return;
      const prototypeData = Object.entries(data).reduce((acc, [key, value]) => {
        acc[`prototypeToken.flags.vgmusic.${key}`] = value;
        return acc;
      }, {});
      const result = await actor.update(prototypeData);
      this.document = actor.prototypeToken;
      this.render(false);
      return result;
    }
    if (this.document.documentName === 'DefaultMusic') {
      const prevData = game.settings.get(CONST.moduleId, CONST.settings.defaultMusic);
      const updateData = foundry.utils.mergeObject(prevData, foundry.utils.expandObject(expandedData), {
        inplace: false,
        performDeletions: true
      });
      await game.settings.set(CONST.moduleId, CONST.settings.defaultMusic, updateData);
      this.document = game.settings.get(CONST.moduleId, CONST.settings.defaultMusic);
      return this.render();
    }
  }

  /**
   * Handle reset action
   * @param {Event} event - The click event
   * @param {HTMLFormElement} _form - The form element
   */
  static handleReset(event, _form) {
    event.preventDefault();
    this.initializeConfig();
    this.render(false);
  }

  /**
   * Open playlist sheet action
   * @param {Event} _event - The click event
   * @param {HTMLElement} target - The target element
   */
  static async openPlaylist(_event, target) {
    const playlistId = target.closest('.playlist-section').dataset.itemId;
    const playlist = game.playlists.get(playlistId);
    if (playlist) playlist.sheet.render(true);
  }

  /**
   * Delete playlist action
   * @param {Event} _event - The click event
   * @param {HTMLElement} target - The target element
   */
  static async deletePlaylist(_event, target) {
    const section = target.closest('.playlist-section').dataset.section;
    await this.updateObject({ [`music.-=${section}`]: null });
  }

  /**
   * Handle form submission
   * @param {Event} _event - The submit event
   * @param {HTMLFormElement} _form - The form element
   * @param {object} formData - The form data
   * @returns {Promise<boolean>} Whether submission succeeded
   * @override
   */
  static async formHandler(_event, _form, formData) {
    const updateData = Object.fromEntries(Object.entries(formData.object).filter(([key]) => key.startsWith('music.')));
    if (Object.keys(updateData).length > 0) {
      try {
        await this.updateObject(updateData);
        game.vgmusic?.musicController?.playCurrentTrack();
        this.close();
      } catch (error) {
        ATLAS.log(1, 'Error updating data:', error);
        ui.notifications.error('Failed to save music configuration');
        return false;
      }
    } else {
      this.close();
    }
    return true;
  }
}

/**
 * Add scene control buttons for music suppression
 * @param {object} controls - The scene controls object
 */
export function getSceneControlButtons(controls) {
  try {
    if (controls.sounds && controls.sounds.tools) {
      controls.sounds.tools['suppress-area-music'] = {
        name: 'suppress-area-music',
        order: 10,
        title: 'VGMusic.Controls.SuppressAreaMusic',
        icon: 'fas fa-dungeon',
        toggle: true,
        visible: true,
        active: game.settings.get(CONST.moduleId, CONST.settings.suppressArea),
        onChange: (_event, active) => {
          game.settings.set(CONST.moduleId, CONST.settings.suppressArea, active);
        }
      };
      controls.sounds.tools['suppress-combat-music'] = {
        name: 'suppress-combat-music',
        order: 11,
        title: 'VGMusic.Controls.SuppressCombatMusic',
        icon: 'fas fa-fist-raised',
        toggle: true,
        visible: true,
        active: game.settings.get(CONST.moduleId, CONST.settings.suppressCombat),
        onChange: (_event, active) => {
          game.settings.set(CONST.moduleId, CONST.settings.suppressCombat, active);
        }
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
export function handleSceneConfigRender(app, html) {
  try {
    const playlistSoundSelect = html.querySelector('select[name="playlistSound"]');
    if (!playlistSoundSelect) return;
    const existingFormGroup = playlistSoundSelect.closest('.form-group');
    if (!existingFormGroup) return;
    const newFormGroup = document.createElement('div');
    newFormGroup.className = 'form-group';
    const label = document.createElement('label');
    label.textContent = _loc('VGMusic.CombatMusic');
    const formFields = document.createElement('div');
    formFields.className = 'form-fields';
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = 'vgmusic-scene';
    button.innerHTML = `<i class="fas fa-music"></i> ${_loc('VGMusic.ConfigTitle')}`;
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = _loc('VGMusic.Settings.DefaultMusic.Hint');
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
export function handleUpdateCombat(combat, updateData) {
  if (combat.started && (updateData.turn != null || updateData.round != null)) game.vgmusic?.musicController?.playCurrentTrack();
}

/**
 * Handle combat deletion to stop music
 */
export function handleDeleteCombat() {
  game.vgmusic?.musicController?.playCurrentTrack();
}

/**
 * Handle combatant creation to refresh music
 * @param {object} combatant - The created combatant
 */
export function handleCreateCombatant(combatant) {
  if (combatant.parent?.started) game.vgmusic?.musicController?.playCurrentTrack();
}

/**
 * Handle combatant deletion to refresh music
 * @param {object} combatant - The deleted combatant
 */
export function handleDeleteCombatant(combatant) {
  if (combatant.parent?.started) game.vgmusic?.musicController?.playCurrentTrack();
}

/**
 * Handle canvas ready to start music
 */
export function handleCanvasReady() {
  game.vgmusic?.musicController?.playCurrentTrack();
}

/**
 * Handle scene updates for music flag changes
 * @param {object} scene - The scene document
 * @param {object} updateData - The update data
 */
export function handleUpdateScene(scene, updateData) {
  if ('flags' in updateData && updateData.flags?.[CONST.moduleId]) game.vgmusic?.musicController?.playCurrentTrack();
  if ('active' in updateData) {
    if (updateData.active !== true) scene.unsetFlag(CONST.moduleId, 'playlist').catch(() => {});
    game.vgmusic?.musicController?.playCurrentTrack();
  }
}

/**
 * Handle actor updates for music flag changes
 * @param {object} _actor - The actor document
 * @param {object} updateData - The update data
 */
export function handleUpdateActor(_actor, updateData) {
  if ('flags' in updateData && updateData.flags?.[CONST.moduleId]) game.vgmusic?.musicController?.playCurrentTrack();
}

/**
 * Handle token updates for music flag changes
 * @param {Document} _token - The token document
 * @param {object} updateData - The update data
 */
export function handleUpdateToken(_token, updateData) {
  if ('flags' in updateData && updateData.flags?.[CONST.moduleId]) game.vgmusic?.musicController?.playCurrentTrack();
}

/**
 * Handle TokenConfig render to inject music configuration
 * @param {object} app - The application
 * @param {HTMLElement} html - The rendered HTML
 * @param {object} _context - Render context
 * @param {object} _options - Render options
 */
export function handleTokenConfigRender(app, html, _context, _options) {
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
    label.textContent = _loc('VGMusic.CombatMusic');
    const formFields = document.createElement('div');
    formFields.className = 'form-fields';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'vgmusic-token-config';
    button.innerHTML = `<i class="fas fa-music"></i> ${_loc('VGMusic.ConfigTitle')}`;
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
      const useTokenMusic = token.getFlag?.(CONST.moduleId, 'useTokenMusic') ?? false;
      const checkboxGroup = document.createElement('div');
      checkboxGroup.className = 'form-group';
      const checkLabel = document.createElement('label');
      checkLabel.textContent = _loc('VGMusic.UseTokenMusic.Label');
      const checkFields = document.createElement('div');
      checkFields.className = 'form-fields';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'flags.vgmusic.useTokenMusic';
      checkbox.checked = useTokenMusic;
      checkFields.appendChild(checkbox);
      checkboxGroup.appendChild(checkLabel);
      checkboxGroup.appendChild(checkFields);
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = _loc('VGMusic.UseTokenMusic.Hint');
      checkboxGroup.appendChild(hint);
      formGroup.insertAdjacentElement('afterend', checkboxGroup);
    }
  } catch (error) {
    ATLAS.log(1, 'Error adding token config button:', error);
  }
}

/**
 * Handle game ready to start music after delay
 */
export async function handleReady() {
  setTimeout(() => {
    game.vgmusic?.musicController?.playCurrentTrack();
  }, 1000);
}
