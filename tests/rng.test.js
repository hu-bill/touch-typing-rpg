import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';

test('same seed gives same sequence', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
});

test('int stays within inclusive bounds', () => {
  const r = createRng(1);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const v = r.int(3, 7);
    assert.ok(v >= 3 && v <= 7);
    seen.add(v);
  }
  assert.equal(seen.size, 5);
});

test('weighted never picks zero weights', () => {
  const r = createRng(5);
  for (let i = 0; i < 1000; i++) {
    const v = r.weighted(['a', 'b', 'c'], (x) => (x === 'b' ? 0 : 1));
    assert.notEqual(v, 'b');
  }
  assert.equal(r.weighted(['a'], () => 0), undefined);
});
