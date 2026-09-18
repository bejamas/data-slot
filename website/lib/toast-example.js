/**
 * @param {HTMLElement} root
 * @param {import('../../packages/toast/src/index').ToastController} toaster
 * @param {AbortSignal} signal
 */
export function bindToastExample(root, toaster, signal) {
  const timers = new Set();
  signal.addEventListener('abort', () => {
    timers.forEach(timer => clearTimeout(timer));
    timers.clear();
  }, { once: true });

  root.querySelector('[data-toast-success]')?.addEventListener('click', () => {
    toaster.show({
      title: 'Changes saved',
      description: 'Your preferences are up to date.',
      type: 'success',
      action: {
        label: 'Undo',
        onClick: () => toaster.show({ title: 'Changes undone', type: 'info' }),
      },
    });
  }, { signal });

  root.querySelector('[data-toast-error]')?.addEventListener('click', () => {
    toaster.show({
      title: 'Could not save',
      description: 'Check your connection and try again.',
      type: 'error',
    });
  }, { signal });

  // A longer description wraps, so the stack mixes toast heights.
  root.querySelector('[data-toast-summary]')?.addEventListener('click', () => {
    toaster.show({
      title: 'Weekly summary ready',
      description: 'Three exports finished, one is still processing, and two drafts were saved automatically while you were away.',
      type: 'info',
    });
  }, { signal });

  root.querySelectorAll('[data-toast-promise]').forEach(button => {
    button.addEventListener('click', () => {
      // Simulate a request. Replace this promise with your own async operation.
      const request = new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (button.getAttribute('data-toast-promise') === 'error') {
            reject(new Error('Please try again in a moment.'));
          } else {
            resolve('Your file is ready.');
          }
        }, 1500);
        timers.add(timer);
      });

      toaster.promise(request, {
        loading: 'Uploading file…',
        success: description => ({ title: 'Upload complete', description }),
        error: error => ({ title: 'Upload failed', description: error.message }),
      });
    }, { signal });
  });

  root.querySelector('[data-toast-clear]')?.addEventListener('click', () => {
    toaster.dismissAll();
  }, { signal });
}
