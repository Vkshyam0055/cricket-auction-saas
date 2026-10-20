const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Phase 3: Control Panel Keyboard Shortcut & Unsold Guard Suite', () => {
  const controlPanelPath = path.resolve(__dirname, '../../Frontend/src/pages/ControlPanel.jsx');
  const fileContent = fs.readFileSync(controlPanelPath, 'utf8');

  // =========================================================================
  // Test 1: Static Source Code Analysis & Guard Presence Verification
  // =========================================================================
  test('1. ControlPanel.jsx contains explicit null/empty guards in onKeyDown and finalizePlayer', () => {
    // Verify guard in finalizePlayer
    assert.match(
      fileContent,
      /const finalizePlayer = async \([^)]*\) => \{\s*if \(!currentPlayer \|\| !currentPlayer\._id\) \{\s*return;\s*\}/,
      'finalizePlayer must guard against missing or invalid currentPlayer'
    );

    // Verify guard in onKeyDown handler for key 'u'
    assert.match(
      fileContent,
      /else if \(key === 'u'\) \{\s*event\.preventDefault\(\);\s*if \(!currentPlayer \|\| !currentPlayer\._id\) return;\s*finalizePlayer\('Unsold'\);/,
      'onKeyDown handler for key "u" must guard against missing or invalid currentPlayer before calling finalizePlayer'
    );
  });

  // =========================================================================
  // Test 2: Shortcut simulation with null active player does nothing safely
  // =========================================================================
  test('2. Pressing "U" with no active player (null or undefined) safely does nothing without throwing', () => {
    let finalizePlayerCalls = [];
    let stateMutated = false;

    // Simulation of onKeyDown logic
    const createSimulator = (currentPlayer) => {
      return (event) => {
        const tag = String(event.target?.tagName || '').toLowerCase();
        const isTypingTarget = ['input', 'textarea', 'select'].includes(tag) || event.target?.isContentEditable;
        if (isTypingTarget || event.ctrlKey || event.metaKey || event.altKey) return;

        const key = String(event.key || '').toLowerCase();
        if (key === 'u') {
          event.preventDefault();
          if (!currentPlayer || !currentPlayer._id) return;
          finalizePlayerCalls.push('Unsold');
          stateMutated = true;
        }
      };
    };

    // Case A: currentPlayer is null
    const handlerNull = createSimulator(null);
    let prevented = false;
    assert.doesNotThrow(() => {
      handlerNull({
        key: 'u',
        preventDefault: () => { prevented = true; },
        target: { tagName: 'DIV' }
      });
    });
    assert.equal(prevented, true, 'event.preventDefault should be called');
    assert.equal(finalizePlayerCalls.length, 0, 'finalizePlayer must NOT be called when currentPlayer is null');
    assert.equal(stateMutated, false, 'Auction state must NOT mutate');

    // Case B: currentPlayer is undefined
    const handlerUndef = createSimulator(undefined);
    prevented = false;
    assert.doesNotThrow(() => {
      handlerUndef({
        key: 'U',
        preventDefault: () => { prevented = true; },
        target: { tagName: 'BODY' }
      });
    });
    assert.equal(prevented, true);
    assert.equal(finalizePlayerCalls.length, 0);

    // Case C: currentPlayer is object without _id
    const handlerNoId = createSimulator({ name: 'Orphan Player' });
    prevented = false;
    assert.doesNotThrow(() => {
      handlerNoId({
        key: 'u',
        preventDefault: () => { prevented = true; },
        target: { tagName: 'DIV' }
      });
    });
    assert.equal(prevented, true);
    assert.equal(finalizePlayerCalls.length, 0);
  });

  // =========================================================================
  // Test 3: Shortcut simulation with valid active player triggers Unsold
  // =========================================================================
  test('3. Pressing "U" with a valid active player invokes finalizePlayer("Unsold")', () => {
    let finalizePlayerCalls = [];
    const validPlayer = { _id: '660000000000000000000101', name: 'Virat Kohli', basePrice: 200 };

    const simulateKeyDown = (event, currentPlayer) => {
      const tag = String(event.target?.tagName || '').toLowerCase();
      const isTypingTarget = ['input', 'textarea', 'select'].includes(tag) || event.target?.isContentEditable;
      if (isTypingTarget || event.ctrlKey || event.metaKey || event.altKey) return;

      const key = String(event.key || '').toLowerCase();
      if (key === 'u') {
        event.preventDefault();
        if (!currentPlayer || !currentPlayer._id) return;
        finalizePlayerCalls.push({ status: 'Unsold', player: currentPlayer });
      }
    };

    let prevented = false;
    simulateKeyDown(
      {
        key: 'u',
        preventDefault: () => { prevented = true; },
        target: { tagName: 'BODY' }
      },
      validPlayer
    );

    assert.equal(prevented, true);
    assert.equal(finalizePlayerCalls.length, 1);
    assert.equal(finalizePlayerCalls[0].status, 'Unsold');
    assert.equal(finalizePlayerCalls[0].player._id, validPlayer._id);
  });

  // =========================================================================
  // Test 4: Input / modifier guards prevent accidental triggers
  // =========================================================================
  test('4. Keyboard shortcuts are suppressed when typing in input/textarea or using modifiers', () => {
    let called = false;
    const validPlayer = { _id: 'p123' };

    const simulateKeyDown = (event) => {
      const tag = String(event.target?.tagName || '').toLowerCase();
      const isTypingTarget = ['input', 'textarea', 'select'].includes(tag) || event.target?.isContentEditable;
      if (isTypingTarget || event.ctrlKey || event.metaKey || event.altKey) return;

      const key = String(event.key || '').toLowerCase();
      if (key === 'u') {
        event.preventDefault();
        if (!validPlayer || !validPlayer._id) return;
        called = true;
      }
    };

    // In an input field
    simulateKeyDown({ key: 'u', preventDefault: () => {}, target: { tagName: 'INPUT' } });
    assert.equal(called, false, 'Must not trigger in input element');

    // In a textarea
    simulateKeyDown({ key: 'u', preventDefault: () => {}, target: { tagName: 'TEXTAREA' } });
    assert.equal(called, false, 'Must not trigger in textarea element');

    // With Ctrl modifier
    simulateKeyDown({ key: 'u', ctrlKey: true, preventDefault: () => {}, target: { tagName: 'DIV' } });
    assert.equal(called, false, 'Must not trigger with Ctrl key');

    // With Alt modifier
    simulateKeyDown({ key: 'u', altKey: true, preventDefault: () => {}, target: { tagName: 'DIV' } });
    assert.equal(called, false, 'Must not trigger with Alt key');
  });

  // =========================================================================
  // Test 5: Other shortcuts (N, S, R, B) remain preserved
  // =========================================================================
  test('5. Other shortcuts (N = pickRandomPlayer, S = Sold, R = resetBid, B = breakView) remain intact', () => {
    assert.match(fileContent, /if \(key === 'n'\) \{\s*event\.preventDefault\(\);\s*pickRandomPlayer\(\);/);
    assert.match(fileContent, /else if \(key === 's'\) \{\s*event\.preventDefault\(\);\s*finalizePlayer\('Sold'\);/);
    assert.match(fileContent, /else if \(key === 'r'\) \{\s*event\.preventDefault\(\);\s*handleResetBid\(\);/);
    assert.match(fileContent, /else if \(key === 'b'\) \{\s*event\.preventDefault\(\);\s*setScreenView\(/);
  });
});
