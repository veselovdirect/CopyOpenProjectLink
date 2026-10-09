export const DEFAULT_TITLE = 'Copy OpenProject Link as Markdown';
// Absolute extension paths: the worker lives in /src/, not beside /icons/.
const icons = (state) => Object.fromEntries([16, 32, 48, 128].map((size) => [size, `/icons/${state}-${size}.png`]));

export function createFeedback(api = chrome) {
  const timers = new Map();
  const revisions = new Map();
  async function reset(tabId) {
    await Promise.all([
      api.action.setIcon({ tabId, path: icons('default') }),
      api.action.setBadgeText({ tabId, text: '' }),
      api.action.setTitle({ tabId, title: DEFAULT_TITLE }),
    ]);
  }
  return {
    async show(tabId, success) {
      clearTimeout(timers.get(tabId));
      const revision = (revisions.get(tabId) ?? 0) + 1;
      revisions.set(tabId, revision);
      await Promise.all([
        api.action.setIcon({ tabId, path: icons(success ? 'success' : 'default') }),
        api.action.setBadgeText({ tabId, text: success ? '' : '!' }),
        api.action.setBadgeBackgroundColor({ tabId, color: '#B42318' }),
        api.action.setTitle({ tabId, title: success
          ? 'Ссылка скопирована'
          : 'Не удалось скопировать. Страница недоступна расширению или браузер запретил буфер обмена.' }),
      ]);
      if (revisions.get(tabId) !== revision) return;
      timers.set(tabId, setTimeout(() => {
        timers.delete(tabId);
        revisions.delete(tabId);
        void reset(tabId).catch(() => {});
      }, success ? 2000 : 4000));
    },
    forget(tabId) {
      clearTimeout(timers.get(tabId));
      timers.delete(tabId);
      revisions.delete(tabId);
    },
  };
}
