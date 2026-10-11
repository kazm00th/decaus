const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../core.js');
const { C, evalC, deriv, normAt, roots, clusterRoots } = D._internal;

const sortC = (zs) => zs.slice().sort((a, b) => a.re - b.re || a.im - b.im);
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-9);

// ---- 多項式と根 ----

test('deriv は高次からの係数で微分する', () => {
  assert.deepEqual(deriv([1, 0, -3, 0]), [3, 0, -3]);
});

test('evalC は複素数で値を返す', () => {
  const v = evalC([1, 0, 1], C(0, 1)); // i² + 1 = 0
  assert.ok(near(v.re, 0) && near(v.im, 0));
});

test('roots：(x−1)(x−2)(x−3)', () => {
  const z = sortC(roots([1, -6, 11, -6]));
  [1, 2, 3].forEach((r, i) => assert.ok(near(z[i].re, r) && near(z[i].im, 0), JSON.stringify(z)));
});

test('roots：x² + 1 は ±i', () => {
  const z = sortC(roots([1, 0, 1]));
  assert.ok(near(z[0].re, 0) && near(z[0].im, -1));
  assert.ok(near(z[1].re, 0) && near(z[1].im, 1));
});

test('roots：末尾の 0 係数は厳密な根 0', () => {
  const z = roots([1, 0, 0, 0]);
  assert.equal(z.length, 3);
  for (const r of z) { assert.equal(r.re, 0); assert.equal(r.im, 0); }
});

test('clusterRoots：(x−1)³ の3重根を1つにまとめ、実数に丸める', () => {
  const p = [4, -12, 12, -4];
  const g = clusterRoots(p, roots(p), 2);
  assert.equal(g.length, 1);
  assert.equal(g[0].m, 3);
  assert.ok(near(g[0].x.re, 1, 1e-12));
  assert.equal(g[0].x.im, 0);
});

test('clusterRoots：1e-4 離れた2根はまとめない', () => {
  const p = [1, 0, -1e-8];
  const g = clusterRoots(p, roots(p), 1);
  assert.equal(g.length, 2);
  for (const r of g) assert.equal(r.m, 1);
});

test('clusterRoots：1e-7 程度に近い2根は重根とみなす', () => {
  const p = [3, 0, -1e-14];
  const g = clusterRoots(p, roots(p), 1);
  assert.equal(g.length, 1);
  assert.equal(g[0].m, 2);
});
