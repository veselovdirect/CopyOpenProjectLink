import { getToolbarMode, setToolbarMode } from './settings.js';

const form = document.getElementById('settings');
const fieldset = document.getElementById('toolbar-modes');
const status = document.getElementById('status');
let savedMode;

form.addEventListener('submit', (event) => event.preventDefault());
form.addEventListener('change', async () => {
  const mode = form.elements.toolbarMode.value;
  fieldset.disabled = true;
  status.textContent = 'Saving…';
  try {
    await setToolbarMode(mode);
    savedMode = mode;
    status.textContent = 'Saved.';
  } catch {
    form.elements.toolbarMode.value = savedMode;
    status.textContent = 'Could not save the setting. Please try again.';
  } finally {
    fieldset.disabled = false;
  }
});

try {
  savedMode = await getToolbarMode();
  form.elements.toolbarMode.value = savedMode;
  fieldset.disabled = false;
  status.textContent = '';
} catch {
  status.textContent = 'Could not load settings. Please reload this page.';
}
