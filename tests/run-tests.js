#!/usr/bin/env node
/*
 * Zero-dependency test suite for Unit Swap Board.
 * Runs with plain Node: node tests/run-tests.js
 *
 * The offer-matching logic lives in index.html (single-file app). To keep one
 * source of truth, this harness extracts the SWAPLOGIC block from index.html,
 * evaluates it, and also syntax-checks the UI script block.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const BEGIN = '/* === SWAPLOGIC BEGIN === */';
const END = '/* === SWAPLOGIC END === */';
const beginIdx = html.indexOf(BEGIN);
const endIdx = html.indexOf(END);
assert.ok(beginIdx !== -1 && endIdx !== -1, 'SWAPLOGIC markers found in index.html');
assert.ok(endIdx > beginIdx, 'SWAPLOGIC markers ordered correctly');
const logicCode = html.slice(beginIdx + BEGIN.length, endIdx);

const appBegin = html.indexOf('<script id="app">');
const appEnd = html.lastIndexOf('</script>');
assert.ok(appBegin !== -1 && appEnd > appBegin, 'app script block found');
const appCode = html.slice(appBegin + '<script id="app">'.length, appEnd);

const SL = new Function(
  'module',
  logicCode + '\nreturn module.exports;'
)({ exports: {} });

// Tests ---------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok - ' + name);
  } catch (err) {
    failed += 1;
    failures.push(name + ': ' + err.message);
    console.log('FAIL - ' + name);
    console.log('       ' + err.message);
  }
}

test('app UI script is syntactically valid', function () {
  new Function(appCode); // compiles (does not execute) — throws on syntax errors
});

test('uid produces unique ids', function () {
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const id = SL.uid('x');
    assert.ok(!seen.has(id), 'duplicate uid: ' + id);
    seen.add(id);
  }
});

test('slotKey and slotParts round-trip', function () {
  assert.strictEqual(SL.slotKey('Mon', 'Day'), 'Mon|Day');
  assert.deepStrictEqual(SL.slotParts('Tue|Night'), ['Tue', 'Night']);
});

test('emptyState creates a 7-day x 3-shift grid with no people or cards', function () {
  const s = SL.emptyState();
  assert.strictEqual(s.days.length, 7);
  assert.strictEqual(s.shifts.length, 3);
  assert.strictEqual(Object.keys(s.slots).length, 21);
  assert.strictEqual(s.people.length, 0);
  assert.strictEqual(s.cards.length, 0);
  assert.strictEqual(s.confirmed.length, 0);
  s.days.forEach((d) => {
    s.shifts.forEach((sh) => {
      const slot = s.slots[SL.slotKey(d, sh)];
      assert.ok(slot, 'slot exists for ' + d + '|' + sh);
      assert.strictEqual(slot.person, '');
      assert.strictEqual(slot.needs, false);
    });
  });
});

test('normalizeState rebuilds a full grid and keeps known assignments', function () {
  const raw = {
    days: ['Mon', 'Tue'],
    slots: { 'Mon|Day': { person: 'Ada', needs: true } },
    people: ['Ada', 'Ada', '  ', 'Ravi'],
    cards: [
      { kind: 'request', slotId: 'Mon|Day', person: 'Ada', detail: 'x', thumb: true },
      { kind: 'bogus', slotId: 'Mon|Day' },
      { kind: 'offer', slotId: 'NoSuchSlot', person: 'Ravi' },
      'garbage'
    ],
    confirmed: [{ slotId: 'Mon|Day', mode: 'weird', requestPerson: 'Ada', offerPerson: 'Ravi' }]
  };
  const s = SL.normalizeState(raw);
  assert.deepStrictEqual(s.days, ['Mon', 'Tue']);
  assert.strictEqual(Object.keys(s.slots).length, 6); // 2 days x 3 shifts
  assert.strictEqual(s.slots['Mon|Day'].person, 'Ada');
  assert.strictEqual(s.slots['Mon|Day'].needs, true);
  assert.deepStrictEqual(s.people, ['Ada', 'Ravi']);
  assert.strictEqual(s.cards.length, 1); // only valid cards survive
  assert.strictEqual(s.cards[0].kind, 'request');
  assert.strictEqual(s.cards[0].id.length > 0, true);
  assert.strictEqual(s.confirmed.length, 1);
  assert.strictEqual(s.confirmed[0].mode, 'pickup'); // unknown mode defaults
  assert.strictEqual(s.confirmed[0].applied, false);
});

test('normalizeState adds people referenced in slots/cards (roster coverage)', function () {
  const s = SL.normalizeState({
    days: ['Mon'],
    slots: { 'Mon|Night': { person: 'Zed', needs: false } },
    cards: [{ kind: 'offer', slotId: 'Mon|Day', person: 'Yara' }]
  });
  assert.ok(s.people.includes('Zed'));
  assert.ok(s.people.includes('Yara'));
});

test('normalizeState rejects out-of-range swap trade-back slots', function () {
  const s = SL.normalizeState({
    days: ['Mon'],
    cards: [{ kind: 'offer', slotId: 'Mon|Day', person: 'A', tradeSlotId: 'Mon|Day' }]
  });
  assert.strictEqual(s.cards[0].tradeSlotId, '');
});

test('buildMatches pairs request+offer on same slot for different nurses', function () {
  const s = SL.normalizeState(null);
  const req = SL.newRequest(s, SL.slotKey('Tue', 'Day'), 'Ada').card;
  const off = SL.newOffer(SL.addCard(s, req), SL.slotKey('Tue', 'Day'), 'Ravi', '').card;
  const state = SL.addCard(SL.addCard(s, req), off);
  const matches = SL.buildMatches(state);
  assert.strictEqual(matches.length, 1);
  assert.strictEqual(matches[0].requestPerson, 'Ada');
  assert.strictEqual(matches[0].offerPerson, 'Ravi');
  assert.strictEqual(matches[0].slotId, 'Tue|Day');
});

test('buildMatches ignores different slots', function () {
  let s = SL.emptyState();
  s = SL.newRequest(s, SL.slotKey('Tue', 'Day'), 'Ada').state;
  s = SL.newOffer(s, SL.slotKey('Wed', 'Night'), 'Ravi', '').state;
  assert.strictEqual(SL.buildMatches(s).length, 0);
});

test('buildMatches ignores same nurse on both sides', function () {
  let s = SL.emptyState();
  s = SL.newRequest(s, SL.slotKey('Tue', 'Day'), 'Ada').state;
  s = SL.newOffer(s, SL.slotKey('Tue', 'Day'), 'Ada', '').state;
  assert.strictEqual(SL.buildMatches(s).length, 0);
});

test('buildMatches never reuses an offer (greedy unique matching)', function () {
  let s = SL.emptyState();
  s = SL.newRequest(s, SL.slotKey('Tue', 'Day'), 'Ada').state;
  s = SL.newRequest(s, SL.slotKey('Tue', 'Day'), 'Mei').state;
  s = SL.newOffer(s, SL.slotKey('Tue', 'Day'), 'Ravi', '').state;
  const matches = SL.buildMatches(s);
  assert.strictEqual(matches.length, 1);
  const offerIds = matches.map((m) => m.offerId);
  assert.strictEqual(new Set(offerIds).size, offerIds.length);
});

test('buildMatches skips done cards', function () {
  let s = SL.emptyState();
  s = SL.newRequest(s, SL.slotKey('Tue', 'Day'), 'Ada').state;
  s = SL.newOffer(s, SL.slotKey('Tue', 'Day'), 'Ravi', '').state;
  s.cards = s.cards.map((c) => Object.assign({}, c, { status: 'done' }));
  assert.strictEqual(SL.buildMatches(s).length, 0);
});

test('confirmMatch requires both thumbs-up', function () {
  let s = SL.emptyState();
  const req = SL.newRequest(s, SL.slotKey('Tue', 'Day'), 'Ada').card;
  s = SL.addCard(s, req);
  const off = SL.newOffer(s, SL.slotKey('Tue', 'Day'), 'Ravi', '').card;
  s = SL.addCard(s, off);
  const match = SL.buildMatches(s)[0];

  const blocked = SL.confirmMatch(s, match, 'pickup');
  assert.strictEqual(blocked.confirmation, null, 'no thumbs -> not confirmed');

  s.cards = s.cards.map((c) => (c.id === req.id ? Object.assign({}, c, { thumb: true }) : c));
  const blocked2 = SL.confirmMatch(s, match, 'pickup');
  assert.strictEqual(blocked2.confirmation, null, 'one thumb -> not confirmed');

  s.cards = s.cards.map((c) => (c.id === off.id ? Object.assign({}, c, { thumb: true }) : c));
  const ok = SL.confirmMatch(s, match, 'pickup');
  assert.ok(ok.confirmation, 'both thumbs -> confirmed');
  assert.strictEqual(ok.state.confirmed.length, 1);
  assert.strictEqual(ok.state.cards.find((c) => c.id === req.id).status, 'done');
  assert.strictEqual(ok.state.cards.find((c) => c.id === off.id).status, 'done');
});

test('confirmMatch does not mutate the input state (pure)', function () {
  let s = SL.emptyState();
  s = SL.newRequest(s, SL.slotKey('Tue', 'Day'), 'Ada').state;
  s = SL.newOffer(s, SL.slotKey('Tue', 'Day'), 'Ravi', '').state;
  s.cards = s.cards.map((c) => Object.assign({}, c, { thumb: true }));
  const snapshot = JSON.stringify(s.cards);
  const match = SL.buildMatches(s)[0];
  SL.confirmMatch(s, match, 'pickup');
  assert.strictEqual(JSON.stringify(s.cards), snapshot, 'input cards unchanged');
});

test('applyConfirmationToSlots pickup fills the requested slot', function () {
  let s = SL.emptyState();
  s = SL.newRequest(s, SL.slotKey('Tue', 'Day'), 'Ada').state;
  s = SL.newOffer(s, SL.slotKey('Tue', 'Day'), 'Ravi', '').state;
  s.cards = s.cards.map((c) => Object.assign({}, c, { thumb: true }));
  s.slots[SL.slotKey('Tue', 'Day')].needs = true;
  const match = SL.buildMatches(s)[0];
  const { state: s2, confirmation } = SL.confirmMatch(s, match, 'pickup');
  const { state: s3 } = SL.applyConfirmationToSlots(s2, confirmation);
  assert.strictEqual(s3.slots[SL.slotKey('Tue', 'Day')].person, 'Ravi');
  assert.strictEqual(s3.slots[SL.slotKey('Tue', 'Day')].needs, false);
  assert.strictEqual(s3.confirmed[0].applied, true);
  assert.strictEqual(s.slots[SL.slotKey('Tue', 'Day')].person, '', 'input state untouched');
});

test('applyConfirmationToSlots swap trades both slots', function () {
  let s = SL.emptyState();
  s = SL.newRequest(s, SL.slotKey('Tue', 'Day'), 'Ada').state;
  s = SL.newOffer(s, SL.slotKey('Tue', 'Day'), 'Ravi', SL.slotKey('Thu', 'Night')).state;
  s.cards = s.cards.map((c) => Object.assign({}, c, { thumb: true }));
  s.slots[SL.slotKey('Thu', 'Night')].person = 'Ravi';
  const match = SL.buildMatches(s)[0];
  const { state: s2, confirmation } = SL.confirmMatch(s, match, 'swap');
  assert.strictEqual(confirmation.tradeSlotId, 'Thu|Night');
  const { state: s3 } = SL.applyConfirmationToSlots(s2, confirmation);
  assert.strictEqual(s3.slots[SL.slotKey('Tue', 'Day')].person, 'Ravi');
  assert.strictEqual(s3.slots[SL.slotKey('Thu', 'Night')].person, 'Ada');
});

test('applyConfirmationToSlots is idempotent (already-applied is a no-op)', function () {
  let s = SL.emptyState();
  s = SL.newRequest(s, SL.slotKey('Tue', 'Day'), 'Ada').state;
  s = SL.newOffer(s, SL.slotKey('Tue', 'Day'), 'Ravi', '').state;
  s.cards = s.cards.map((c) => Object.assign({}, c, { thumb: true }));
  const { state: s2, confirmation } = SL.confirmMatch(s, SL.buildMatches(s)[0], 'pickup');
  const res1 = SL.applyConfirmationToSlots(s2, confirmation);
  const res2 = SL.applyConfirmationToSlots(res1.state, res1.state.confirmed[0]);
  assert.strictEqual(res2.changed, false);
});

test('tallyFairness: pickup credit goes to the coverer; received to the requester', function () {
  let s = SL.emptyState();
  s.people = ['Ada', 'Ravi'];
  s = SL.normalizeState(s);
  s = SL.newRequest(s, SL.slotKey('Tue', 'Day'), 'Ada').state;
  s = SL.newOffer(s, SL.slotKey('Tue', 'Day'), 'Ravi', '').state;
  s.cards = s.cards.map((c) => Object.assign({}, c, { thumb: true }));
  const { state: s2 } = SL.confirmMatch(s, SL.buildMatches(s)[0], 'pickup');
  const rows = SL.tallyFairness(s2);
  const ada = rows.find((r) => r.person === 'Ada');
  const ravi = rows.find((r) => r.person === 'Ravi');
  assert.strictEqual(ada.given, 0);
  assert.strictEqual(ada.received, 1);
  assert.strictEqual(ada.net, -1);
  assert.strictEqual(ravi.given, 1);
  assert.strictEqual(ravi.received, 0);
  assert.strictEqual(ravi.net, 1);
});

test('tallyFairness: an even swap nets zero for both nurses', function () {
  let s = SL.emptyState();
  s = SL.newRequest(s, SL.slotKey('Tue', 'Day'), 'Ada').state;
  s = SL.newOffer(s, SL.slotKey('Tue', 'Day'), 'Ravi', SL.slotKey('Thu', 'Night')).state;
  s.cards = s.cards.map((c) => Object.assign({}, c, { thumb: true }));
  const { state: s2 } = SL.confirmMatch(s, SL.buildMatches(s)[0], 'swap');
  const rows = SL.tallyFairness(s2);
  rows.forEach((r) => {
    assert.strictEqual(r.given, 1);
    assert.strictEqual(r.received, 1);
    assert.strictEqual(r.net, 0);
  });
});

test('tallyFairness starts at zero for the whole roster', function () {
  const s = SL.normalizeState({ people: ['Ada', 'Ravi'] });
  const rows = SL.tallyFairness(s);
  assert.strictEqual(rows.length, 2);
  rows.forEach((r) => assert.strictEqual(r.net, 0));
});

test('noteLines includes both nurses, shift, signatures and safety wording', function () {
  let s = SL.emptyState();
  s = SL.newRequest(s, SL.slotKey('Tue', 'Day'), 'Ada').state;
  s = SL.newOffer(s, SL.slotKey('Tue', 'Day'), 'Ravi', '').state;
  s.cards = s.cards.map((c) => Object.assign({}, c, { thumb: true }));
  const { state: s2, confirmation } = SL.confirmMatch(s, SL.buildMatches(s)[0], 'pickup');
  const lines = SL.noteLines(s2, confirmation).join('\n');
  assert.ok(lines.includes('Ada'), 'requester named');
  assert.ok(lines.includes('Ravi'), 'offerer named');
  assert.ok(lines.includes('Tue \u00b7 Day'), 'shift named');
  assert.ok(lines.includes('signature'), 'signature lines present');
  assert.ok(lines.includes('supervisor'), 'supervisor sign-off present');
  assert.ok(/official/i.test(lines), 'official-process reminder present');
  assert.ok(/not medical advice/i.test(lines), 'medical-advice disclaimer present');
});

test('sampleState produces matchable pending cards plus recorded history', function () {
  const s = SL.sampleState();
  assert.ok(s.people.length >= 3);
  assert.ok(s.cards.some((c) => c.status === 'open' && c.kind === 'request'));
  assert.ok(s.cards.some((c) => c.status === 'open' && c.kind === 'offer'));
  assert.strictEqual(s.confirmed.length, 1);
  const matches = SL.buildMatches(s);
  assert.ok(matches.length >= 1, 'sample has at least one possible match');
});

test('sampleState can be normalized without losing data', function () {
  const s = SL.normalizeState(JSON.parse(JSON.stringify(SL.sampleState())));
  assert.ok(s.people.length >= 3);
  assert.ok(s.cards.length >= 2);
  assert.strictEqual(s.confirmed.length, 1);
});

// Summary -------------------------------------------------------------------

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
