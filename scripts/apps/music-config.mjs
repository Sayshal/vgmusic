import { MODULE, SETTINGS, TEMPLATES } from '../constants.mjs';
import { musicController } from '../music-controller.mjs';
import { getSections } from '../section-registry.mjs';

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;
const { DragDrop } = foundry.applications.ux;

/**
 * Build the context the section form renders from
 * @param {object} options - Form seed
 * @param {object} options.sections - Available sections keyed by context, from getSections
 * @param {object} options.playlist - The playlist being assigned
 * @param {string} options.section - Context key to preselect
 * @param {string} options.initialTrack - Track id to preselect, empty for the playlist default
 * @param {number} options.priority - Priority to prefill
 * @returns {object} Template context
 */
function sectionFormContext({ sections, playlist, section, initialTrack, priority }) {
  const sectionChoices = Object.fromEntries(Object.entries(sections).map(([key, config]) => [key, _loc(config.label)]));
  const meta = Object.fromEntries(Object.entries(sections).map(([key, config]) => [key, { priority: config.priority ?? 0, hint: config.hint ? _loc(config.hint) : '' }]));
  const tracks = playlist?.playbackOrder?.reduce((obj, id) => {
    obj[id] = playlist.sounds.get(id).name;
    return obj;
  }, {});
  return { sections: sectionChoices, meta: JSON.stringify(meta), tracks: tracks ?? {}, section, initialTrack, priority, sectionHint: meta[section]?.hint ?? '' };
}

/**
 * Ask which section a playlist belongs to, and how it should play
 * @param {object} options - Form seed, see sectionFormContext
 * @returns {Promise<object|null>} The chosen section, track and priority, or null when dismissed
 */
async function promptSectionConfig(options) {
  return DialogV2.prompt({
    window: { title: game.i18n.format('VGMUSIC.SectionConfig.Title', { playlist: options.playlist?.name ?? '' }), icon: 'fas fa-music' },
    content: await renderTemplate(TEMPLATES.SECTION_CONFIG, sectionFormContext(options)),
    ok: {
      label: 'VGMUSIC.SectionConfig.Assign',
      icon: 'fas fa-check',
      callback: (_event, button) => ({
        section: button.form.elements.section.value,
        initialTrack: button.form.elements.initialTrack.value,
        priority: Number(button.form.elements.priority.value) || 0
      })
    },
    render: (_event, dialog) => {
      const form = dialog.element.querySelector('form');
      const meta = JSON.parse(form.elements.sectionMeta.value);
      const hint = form.querySelector('[data-section-hint]');
      form.elements.section.addEventListener('change', (event) => {
        const selected = meta[event.currentTarget.value] ?? {};
        form.elements.priority.value = selected.priority ?? 0;
        hint.textContent = selected.hint ?? '';
      });
    },
    rejectClose: false,
    classes: [MODULE.ID]
  });
}

/**
 * Music configuration application
 */
export class VGMusicConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'vgmusic-config-{id}',
    tag: 'div',
    window: { title: 'VGMUSIC.ConfigTitle', icon: 'fas fa-music', resizable: true },
    position: { width: 560, height: 'auto' },
    actions: {
      openPlaylist: VGMusicConfig.openPlaylist,
      configureSection: VGMusicConfig.configureSection,
      deletePlaylist: VGMusicConfig.deletePlaylist
    },
    classes: [MODULE.ID],
    dragDrop: [{ dragSelector: null, dropSelector: '.vgmusic-sections', permissions: { dragstart: false, drop: true }, callbacks: {} }]
  };

  /** @override */
  static PARTS = { main: { template: TEMPLATES.MUSIC_CONFIG } };

  /**
   * Create a new configuration instance
   * @param {object} object The document object to configure
   * @param {object} [options] Additional application options
   */
  constructor(object, options = {}) {
    super(options);
    this.document = object || game.settings.get(MODULE.ID, SETTINGS.DEFAULT_MUSIC);
  }

  /**
   * Get the update data prefix based on document type
   * @returns {string} The prefix path for flag updates
   */
  get updateDataPrefix() {
    return this.documentTypeName === 'DefaultMusic' ? `data.${MODULE.ID}` : `flags.${MODULE.ID}`;
  }

  /**
   * Get the document type name for playlist sections lookup
   * @returns {string|undefined} The document type name
   */
  get documentTypeName() {
    if (this.document.documentName) return this.document.documentName;
    if (this.document.constructor.name === 'PrototypeToken') return 'Token';
    return undefined;
  }

  /**
   * Read this document's stored music configuration
   * @returns {object} Section data keyed by context
   */
  get musicData() {
    return foundry.utils.getProperty(this.document, `${this.updateDataPrefix}.music`) || {};
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sections = getSections(this.documentTypeName) || {};
    const music = this.musicData;
    const rows = Object.entries(sections)
      .filter(([key]) => music[key]?.playlist)
      .map(([key, config]) => {
        const data = music[key];
        const playlist = game.playlists.get(data.playlist);
        return {
          id: key,
          label: _loc(config.label),
          playlistId: data.playlist,
          playlistName: playlist?.name ?? _loc('VGMUSIC.MissingPlaylist'),
          trackName: playlist?.sounds.get(data.initialTrack)?.name ?? _loc('ATLAS.Common.Default'),
          priority: data.priority ?? config.priority ?? 0
        };
      })
      .sort((a, b) => b.priority - a.priority);
    return { ...context, rows };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    for (const descriptor of this.options.dragDrop) {
      descriptor.callbacks = { dragover: this.onDragOver.bind(this), drop: this.onDrop.bind(this) };
      new DragDrop(descriptor).bind(this.element);
    }
  }

  /**
   * Highlight the drop target while a playlist is dragged over it
   * @param {DragEvent} event - The drag event
   */
  onDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drop-hover');
  }

  /**
   * Assign a dropped playlist to a section, asking how it should play
   * @param {DragEvent} event - The drop event
   * @returns {Promise<boolean>} Whether the drop was handled
   */
  async onDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drop-hover');
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (!['Playlist', 'PlaylistSound'].includes(data?.type) || !data.uuid) return false;
    const dropped = await fromUuid(data.uuid);
    if (!dropped) return false;
    const playlist = dropped instanceof PlaylistSound ? dropped.parent : dropped;
    const sound = dropped instanceof PlaylistSound ? dropped : null;
    const sections = getSections(this.documentTypeName);
    if (!sections) return false;
    const section = Object.keys(sections)[0];
    const result = await promptSectionConfig({ sections, playlist, section, initialTrack: sound?.id ?? '', priority: sections[section].priority ?? 0 });
    if (!result) return false;
    await this.assignSection(result, playlist.id);
    return true;
  }

  /**
   * Write a section assignment, clearing the previous one when the section changed
   * @param {object} result - The chosen section, track and priority
   * @param {string} result.section - Context key to assign the playlist to
   * @param {string} result.initialTrack - Track id to start from, empty for the playlist default
   * @param {number} result.priority - Sort priority for this section
   * @param {string} playlistId - The playlist to assign
   * @param {string} [previousSection] - Section the assignment is moving away from
   * @returns {Promise<void>} Resolves once the write completes
   */
  async assignSection({ section, initialTrack, priority }, playlistId, previousSection) {
    const updateData = {
      [`music.${section}.playlist`]: playlistId,
      [`music.${section}.initialTrack`]: initialTrack || '',
      [`music.${section}.priority`]: priority
    };
    if (previousSection && previousSection !== section) updateData[`music.-=${previousSection}`] = null;
    await this.updateObject(updateData);
    musicController.playCurrentTrack();
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
    try {
      if (this.document.constructor.name === 'PrototypeToken') {
        const actor = this.document.parent;
        if (!actor) return;
        const prototypeData = Object.entries(data).reduce((acc, [key, value]) => {
          acc[`prototypeToken.flags.${MODULE.ID}.${key}`] = value;
          return acc;
        }, {});
        await actor.update(prototypeData);
        this.document = actor.prototypeToken;
      } else if (this.documentTypeName === 'DefaultMusic') {
        const prevData = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_MUSIC);
        const updateData = foundry.utils.mergeObject(prevData, foundry.utils.expandObject(expandedData), {
          inplace: false,
          performDeletions: true
        });
        await game.settings.set(MODULE.ID, SETTINGS.DEFAULT_MUSIC, updateData);
        this.document = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_MUSIC);
      } else {
        await this.document.update(expandedData);
      }
    } catch (error) {
      ATLAS.log(1, 'Error updating data:', error);
      ui.notifications.error('VGMUSIC.Error.SaveFailed');
      return;
    }
    this.render(false);
  }

  /**
   * Open the playlist sheet for a row
   * @param {Event} _event - The click event
   * @param {HTMLElement} target - The target element
   */
  static async openPlaylist(_event, target) {
    const playlist = game.playlists.get(target.closest('[data-section]').dataset.itemId);
    if (playlist) playlist.sheet.render(true);
  }

  /**
   * Reconfigure an assigned section
   * @param {Event} _event - The click event
   * @param {HTMLElement} target - The target element
   */
  static async configureSection(_event, target) {
    const section = target.closest('[data-section]').dataset.section;
    const data = this.musicData[section];
    const sections = getSections(this.documentTypeName);
    if (!sections) return;
    const playlist = game.playlists.get(data.playlist);
    const result = await promptSectionConfig({ sections, playlist, section, initialTrack: data.initialTrack ?? '', priority: data.priority ?? sections[section]?.priority ?? 0 });
    if (!result) return;
    await this.assignSection(result, data.playlist, section);
  }

  /**
   * Clear a section's assignment
   * @param {Event} _event - The click event
   * @param {HTMLElement} target - The target element
   */
  static async deletePlaylist(_event, target) {
    const section = target.closest('[data-section]').dataset.section;
    await this.updateObject({ [`music.-=${section}`]: null });
    musicController.playCurrentTrack();
  }
}
