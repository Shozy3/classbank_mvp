export function applyFilterRules(state, action) {
  const source = state && typeof state === 'object' ? state : {};
  const next = {
    incorrectOnly: Boolean(source.incorrectOnly),
    adaptiveWeakOnly: Boolean(source.adaptiveWeakOnly),
    unseenOnly: Boolean(source.unseenOnly),
    mode: source.mode || 'free_practice',
  };

  if (!action || typeof action !== 'object') {
    return next;
  }

  if (action.type === 'toggleIncorrect') {
    next.incorrectOnly = Boolean(action.checked);
    if (next.incorrectOnly) {
      next.unseenOnly = false;
      next.adaptiveWeakOnly = false;
    }
    return next;
  }

  if (action.type === 'toggleAdaptiveWeak') {
    next.adaptiveWeakOnly = Boolean(action.checked);
    if (next.adaptiveWeakOnly) {
      next.incorrectOnly = false;
      next.unseenOnly = false;
      if (next.mode === 'review_incorrect') {
        next.mode = 'free_practice';
      }
    }
    return next;
  }

  if (action.type === 'toggleUnseen') {
    next.unseenOnly = Boolean(action.checked);
    if (next.unseenOnly) {
      next.incorrectOnly = false;
      next.adaptiveWeakOnly = false;
      if (next.mode === 'review_incorrect') {
        next.mode = 'free_practice';
      }
    }
    return next;
  }

  if (action.type === 'setMode') {
    next.mode = action.mode || next.mode;
    if (next.mode === 'review_incorrect') {
      next.incorrectOnly = true;
      next.unseenOnly = false;
      next.adaptiveWeakOnly = false;
    }
    return next;
  }

  return next;
}
