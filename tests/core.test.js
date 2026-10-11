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

// ---- compute ----

const imagEnds = (r) => r.strands.filter((s) => !s.real)
  .map((s) => s.ends.slice().sort((a, b) => a - b))
  .sort((a, b) => a[0] - b[0]);
const realEnds = (r) => r.strands.find((s) => s.real).ends.slice().sort((a, b) => a - b);

test('入力の検査', () => {
  assert.throws(() => D.compute([0, 1, 2]), /最高次の係数が 0/);
  assert.throws(() => D.compute([1]), /次数は 1〜8/);
  assert.throws(() => D.compute([1, 0, 0, 0, 0, 0, 0, 0, 0, 0]), /次数は 1〜8/);
  assert.throws(() => D.compute([1, NaN]), /数値ではありません/);
});

test('x² − 2x + 2：虚の放物線は Re x = 1、y = 1 − (Im x)²', () => {
  const r = D.compute([1, -2, 2]);
  assert.ok(r.check.ok, r.check.message);
  const im = r.strands.filter((s) => !s.real);
  assert.equal(im.length, 1);
  for (const q of im[0].points) {
    assert.ok(near(q[0], 1, 1e-9), 'Re x = ' + q[0]);
    assert.ok(near(q[2], 1 - q[1] * q[1], 1e-7 * (1 + Math.abs(q[2]))), 'y = ' + q[2]);
  }
});

test('x³：原点で交わる2直線（60°–240°、120°–300°）', () => {
  const r = D.compute([1, 0, 0, 0]);
  assert.ok(r.check.ok, r.check.message);
  assert.deepEqual(realEnds(r), [0, 3]);
  assert.deepEqual(imagEnds(r), [[1, 4], [2, 5]]);
  assert.equal(r.vertices.length, 1);
  assert.equal(r.vertices[0].m, 2);
  assert.equal(r.degenerate, true);
});

test('x³ − εx（ε > 0）：60°–300°、120°–240°', () => {
  const r = D.compute([1, 0, -0.01, 0]);
  assert.ok(r.check.ok, r.check.message);
  assert.deepEqual(imagEnds(r), [[1, 5], [2, 4]]);
  assert.equal(r.degenerate, false);
});

test('x³ + εx（ε > 0）：60°–120°、240°–300°', () => {
  const r = D.compute([1, 0, 0.01, 0]);
  assert.ok(r.check.ok, r.check.message);
  assert.deepEqual(imagEnds(r), [[1, 2], [4, 5]]);
  assert.equal(r.vertices.length, 0);
});

test('−x³：実曲線の端は漸近方向 1 と 4', () => {
  const r = D.compute([-1, 0, 0, 0]);
  assert.ok(r.check.ok, r.check.message);
  assert.deepEqual(realEnds(r), [1, 4]);
});

test('1次式：実の直線が1本だけ', () => {
  for (const c of [[2, 1], [-1, 1]]) {
    const r = D.compute(c);
    assert.ok(r.check.ok, r.check.message);
    assert.equal(r.strands.length, 1);
    assert.equal(r.strands[0].real, true);
    assert.deepEqual(realEnds(r), [0, 1]);
  }
});

test('x⁴ + x²：±i/√2 も頂点（f(c) が実数の複素臨界点）', () => {
  const r = D.compute([1, 0, 1, 0, 0]);
  assert.ok(r.check.ok, r.check.message);
  assert.equal(r.vertices.length, 3);
  const up = r.vertices.find((v) => v.x.im > 0.5);
  assert.ok(near(up.x.im, Math.SQRT1_2, 1e-12) && near(up.y, -0.25, 1e-12));
  assert.equal(r.degenerate, true);
});

test('(x−1)⁴：頂点は x = 1 の1つで m = 3', () => {
  const r = D.compute([1, -4, 6, -4, 1]);
  assert.ok(r.check.ok, r.check.message);
  assert.equal(r.vertices.length, 1);
  assert.equal(r.vertices[0].m, 3);
  assert.deepEqual(imagEnds(r), [[1, 5], [2, 6], [3, 7]]);
});

test('x⁴ + (4/3)x³：停留変曲点で通り抜け', () => {
  const r = D.compute([1, 4 / 3, 0, 0, 0]);
  assert.ok(r.check.ok, r.check.message);
  assert.deepEqual(imagEnds(r), [[1, 6], [2, 7], [3, 5]]);
});

test('解の重心は −b/(a·n) で、解の平均に等しい', () => {
  const r = D.compute([2, 3, 0, 1]);
  assert.ok(near(r.centroid, -0.5, 1e-15));
  const mean = r.roots.reduce((s, z) => s + z.re, 0) / r.roots.length;
  assert.ok(near(mean, -0.5, 1e-9));
});

test('通り抜け：頂点の前後で曲線の向きが反対', () => {
  for (const c of [[1, 0, 0, 0], [1, 0, 0, 0, 0], [1, 4 / 3, 0, 0, 0], [1, -4, 6, -4, 1], [1, 0, -2, 0, 0]]) {
    const r = D.compute(c);
    for (const s of r.strands) {
      for (let i = 1; i < s.points.length - 1; i++) {
        const q = s.points[i];
        if (!r.vertices.some((v) => v.x.re === q[0] && v.x.im === q[1])) continue;
        const a = [s.points[i - 1][0] - q[0], s.points[i - 1][1] - q[1]];
        const b = [s.points[i + 1][0] - q[0], s.points[i + 1][1] - q[1]];
        const cos = (a[0] * b[0] + a[1] * b[1]) / Math.hypot(a[0], a[1]) / Math.hypot(b[0], b[1]);
        assert.ok(cos < -0.99, JSON.stringify(c) + ' cos = ' + cos);
      }
    }
  }
});

// 乱数（線形合同法、種固定）
function rng(seed) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
}
function samples() {
  const rnd = rng(12345), out = [];
  for (let n = 1; n <= 8; n++) {
    for (let t = 0; t < 40; t++) {
      const c = [];
      for (let i = 0; i <= n; i++) c.push(Math.round((rnd() * 10 - 5) * 100) / 100);
      if (c[0] === 0) c[0] = 1;
      out.push(c);
    }
    for (let t = 0; t < 40; t++) { // 小さい整数係数：重根や対称が起きやすい
      const c = [];
      for (let i = 0; i <= n; i++) c.push(Math.floor(rnd() * 5) - 2);
      if (c[0] === 0) c[0] = 1;
      out.push(c);
    }
  }
  return out;
}

test('乱数の係数 640 通りで検算が通る', () => {
  for (const c of samples()) {
    const r = D.compute(c);
    assert.ok(r.check.ok, JSON.stringify(c) + ' ' + r.check.message);
  }
});

test('曲線上のすべての点で Im f ≈ 0、頂点と頂点の間で y は単調', () => {
  for (const c of samples().filter((_, i) => i % 8 === 0)) {
    const r = D.compute(c);
    for (const s of r.strands) {
      let dir = 0;
      for (let i = 0; i < s.points.length; i++) {
        const q = s.points[i], z = C(q[0], q[1]);
        assert.ok(Math.abs(evalC(c, z).im) <= 1e-9 * normAt(c, z), JSON.stringify(c));
        if (r.vertices.some((v) => v.x.re === q[0] && v.x.im === q[1])) { dir = 0; continue; }
        if (i === 0) continue;
        const d = Math.sign(q[2] - s.points[i - 1][2]);
        if (dir === 0) dir = d;
        else assert.equal(d, dir, JSON.stringify(c) + ' で y が単調でない');
      }
    }
  }
});

// ---- 起きやすい入力（Review Focus）----

test('臨界点が 1e-7 まで近づいても一般の場合のつながり方', () => {
  const r = D.compute([1, 0, -1e-7, 0]);
  assert.ok(r.check.ok, r.check.message);
  assert.deepEqual(imagEnds(r), [[1, 5], [2, 4]]);
});

test('臨界点が 1e-6 より近いと重根として通り抜け', () => {
  const r = D.compute([1, 0, -1e-12, 0]);
  assert.ok(r.check.ok, r.check.message);
  assert.deepEqual(imagEnds(r), [[1, 4], [2, 5]]);
  assert.equal(r.degenerate, true);
});

test('最高次の係数が小さい（根が遠い）', () => {
  const r = D.compute([0.001, 0, -1, 0]);
  assert.ok(r.check.ok, r.check.message);
});

test('8次で係数が大きくても 100ms 以内', () => {
  const c = [5, -5, 5, -5, 5, -5, 5, -5, 5];
  const t0 = Date.now();
  const r = D.compute(c);
  assert.ok(r.check.ok, r.check.message);
  assert.ok(Date.now() - t0 < 100, (Date.now() - t0) + 'ms');
});
