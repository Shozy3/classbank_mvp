import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFilterRules } from '../practice-setup/js/filter-rules.mjs';

describe('applyFilterRules', () => {
  test('enabling incorrect clears unseen and adaptiveWeak', () => {
    const next = applyFilterRules(
      { incorrectOnly: false, adaptiveWeakOnly: true, unseenOnly: true, mode: 'free_practice' },
      { type: 'toggleIncorrect', checked: true }
    );

    assert.equal(next.incorrectOnly, true);
    assert.equal(next.adaptiveWeakOnly, false);
    assert.equal(next.unseenOnly, false);
  });

  test('enabling adaptiveWeak clears incorrect/unseen and exits review_incorrect mode', () => {
    const next = applyFilterRules(
      { incorrectOnly: true, adaptiveWeakOnly: false, unseenOnly: true, mode: 'review_incorrect' },
      { type: 'toggleAdaptiveWeak', checked: true }
    );

    assert.equal(next.adaptiveWeakOnly, true);
    assert.equal(next.incorrectOnly, false);
    assert.equal(next.unseenOnly, false);
    assert.equal(next.mode, 'free_practice');
  });

  test('enabling unseen clears incorrect/adaptive and exits review_incorrect mode', () => {
    const next = applyFilterRules(
      { incorrectOnly: true, adaptiveWeakOnly: true, unseenOnly: false, mode: 'review_incorrect' },
      { type: 'toggleUnseen', checked: true }
    );

    assert.equal(next.unseenOnly, true);
    assert.equal(next.incorrectOnly, false);
    assert.equal(next.adaptiveWeakOnly, false);
    assert.equal(next.mode, 'free_practice');
  });

  test('switching to review_incorrect sets incorrectOnly and clears conflicting filters', () => {
    const next = applyFilterRules(
      { incorrectOnly: false, adaptiveWeakOnly: true, unseenOnly: true, mode: 'free_practice' },
      { type: 'setMode', mode: 'review_incorrect' }
    );

    assert.equal(next.mode, 'review_incorrect');
    assert.equal(next.incorrectOnly, true);
    assert.equal(next.adaptiveWeakOnly, false);
    assert.equal(next.unseenOnly, false);
  });

  test('disabling adaptiveWeak preserves other flags', () => {
    const next = applyFilterRules(
      { incorrectOnly: true, adaptiveWeakOnly: true, unseenOnly: false, mode: 'free_practice' },
      { type: 'toggleAdaptiveWeak', checked: false }
    );

    assert.equal(next.adaptiveWeakOnly, false);
    assert.equal(next.incorrectOnly, true);
    assert.equal(next.unseenOnly, false);
  });
});
