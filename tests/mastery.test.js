import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordKey, recordKeyTracked, keyMastery, masteryProgress, weakChars, WINDOW } from '../src/logic/mastery.js';

test('windows are capped', () => {
  const ks = {};
  for (let i = 0; i < 100; i++) recordKey(ks, 'a', true, 200);
  assert.equal(ks.a.recent.length, WINDOW);
  assert.equal(ks.a.ms.length, WINDOW);
  assert.equal(ks.a.n, 100);
});

test('mastery levels follow thresholds', () => {
  const ks = {};
  for (let i = 0; i < 25; i++) recordKey(ks, 'a', true, 400);
  assert.equal(keyMastery(ks.a), 1);
  for (let i = 0; i < 100; i++) recordKey(ks, 'b', true, 200);
  assert.equal(keyMastery(ks.b), 3);
  for (let i = 0; i < 100; i++) recordKey(ks, 'c', i % 5 !== 0, 200);
  assert.equal(keyMastery(ks.c), 0);
  assert.equal(keyMastery(undefined), 0);
});

test('weakChars finds slow and inaccurate keys', () => {
  const ks = {};
  for (let i = 0; i < 20; i++) {
    recordKey(ks, 'a', true, 180);
    recordKey(ks, 's', true, 700);
    recordKey(ks, 'd', i % 2 === 0, 200);
    recordKey(ks, 'f', true, 190);
  }
  const weak = weakChars(ks, new Set(['a', 's', 'd', 'f', ' ']), 2);
  assert.deepEqual(weak.sort(), ['d', 's']);
});

test('recordKeyTracked announces each new personal best once', () => {
  const ks = {};
  for (let i = 0; i < 19; i++) assert.equal(recordKeyTracked(ks, 'a', true, 200), 0);
  assert.equal(recordKeyTracked(ks, 'a', true, 200), 1);
  assert.equal(recordKeyTracked(ks, 'a', true, 200), 0);
  assert.equal(recordKeyTracked(ks, 'a', false, null), 0);
});

test('recordKeyTracked does not re-announce mastery from old saves', () => {
  const ks = {};
  for (let i = 0; i < 25; i++) recordKey(ks, 'b', true, 300);
  assert.equal(keyMastery(ks.b), 1);
  assert.equal(ks.b.peak, undefined);
  assert.equal(recordKeyTracked(ks, 'b', true, 300), 0);
  assert.equal(ks.b.peak, 1);
});

test('masteryProgress', () => {
  const ks = {};
  for (let i = 0; i < 10; i++) recordKey(ks, 'a', true, 200);
  const p = masteryProgress(ks.a);
  assert.equal(p.next, 1);
  assert.equal(p.progress, 0.5);
  assert.deepEqual(p.need, { kind: 'presses', value: 10 });
  for (let i = 0; i < 100; i++) recordKey(ks, 'z', true, 200);
  assert.equal(masteryProgress(ks.z), null);
});
