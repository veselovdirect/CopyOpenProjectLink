import { COPY_MODES } from './link-builder.js';

export const TOOLBAR_MODE_KEY = 'toolbarCopyMode';
const modes = [COPY_MODES.TITLE, COPY_MODES.SHORT_TITLE, COPY_MODES.WORK_PACKAGE_ID];

export async function getToolbarMode(api = chrome) {
  const settings = await api.storage.local.get(TOOLBAR_MODE_KEY);
  return modes.includes(settings[TOOLBAR_MODE_KEY]) ? settings[TOOLBAR_MODE_KEY] : COPY_MODES.TITLE;
}

export async function setToolbarMode(mode, api = chrome) {
  if (!modes.includes(mode)) throw new Error('INVALID_TOOLBAR_MODE');
  await api.storage.local.set({ [TOOLBAR_MODE_KEY]: mode });
}
