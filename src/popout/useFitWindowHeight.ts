import { useEffect } from 'react';
import browser from 'webextension-polyfill';

/**
 * Увеличивает высоту окна popout, если содержимое страницы перестаёт в него помещаться
 * (например, когда под кнопкой появляется сообщение об ошибке).
 * Окно только растёт, чтобы не дёргалось при каждом изменении контента.
 */
export function useFitWindowHeight() {
  useEffect(() => {
    let updating = false;

    const fit = () => {
      const contentHeight = document.documentElement.scrollHeight;
      const overflow = contentHeight - window.innerHeight;
      if (overflow <= 0 || updating) {
        return;
      }

      updating = true;
      browser.windows.getCurrent()
        .then((win) => {
          if (win.id === undefined) {
            return;
          }
          return browser.windows.update(win.id, { height: window.outerHeight + overflow });
        })
        .catch(() => { })
        .finally(() => {
          updating = false;
        });
    };

    const observer = new ResizeObserver(fit);
    observer.observe(document.documentElement);
    fit();

    return () => observer.disconnect();
  }, []);
}
