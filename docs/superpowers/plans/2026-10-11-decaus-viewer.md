# デカウス空間ビューア 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 実係数多項式 y = f(x) の、f(x) が実数となる複素数 x の集合（デカウス曲線）を3次元に描き、回して見られるブラウザアプリを作る。

**Architecture:** 計算の中核 `core.js`（DOM なし、Node でもテスト可能）と、描画・操作の `view.js`、画面の `index.html` に分ける。曲線は臨界点を頂点として予測子・修正子法でたどり、頂点では向かい合う枝をつなぐ（通り抜けの規則）。色は無限遠の漸近方向の番号で決める。

**Tech Stack:** 素の JavaScript（ES2015+、ES モジュールは使わない）、Canvas 2D、`node:test`（Node 24）。

**Spec:** `docs/superpowers/specs/2026-10-11-decaus-viewer-design.md`

## Global Constraints

- 外部ライブラリなし。ES モジュールは使わず `<script src>` で読む（`file://` で開けること）。
- core.js は DOM に触れない。末尾で `module.exports`（Node）または `window.Decaus`（ブラウザ）に公開。
- 対象は実係数の多項式、次数 n = 1〜8、係数は高次から `[a_n, …, a_0]`、a_n ≠ 0。
- 実曲線は黒、虚曲線は色 `['#d62728', '#1f5fd6', '#2ca02c', '#ff7f0e', '#9467bd', '#17a2a2', '#8c564b']`（赤・青・緑・橙・紫・青緑・茶）。
- Node はフルパス `D:\node-v24.20.0-win-x64\node.exe`（Bash では `/d/node-v24.20.0-win-x64/node.exe`）。テストは `node --test tests/core.test.js`（`tests/` とディレクトリを渡すと Node 24 では失敗する）。
- 作業ディレクトリは `D:\claude_code\decaus`。実装はブランチ `feat/viewer`、最後に main へ `--no-ff` でマージ。push しない。
- コミットメッセージの末尾は `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- コード中のコメント・UI の文言は日本語。
- ファイルの編集は Write・Edit ツールで行う（スクリプトで書き換えない）。JS の文字列に `\u` エスケープを書かない（ツールが文字に変えてしまうため。上付き数字などは文字そのものを書く）。

## Review Focus

1. スライダーで臨界点同士が 1e-7 まで近づく（退化の直前）→ 計算は成功し、一般の場合のつながり方で色が付く（Task 2 のテスト「臨界点が 1e-7 まで近づいても…」）。
2. 最高次の係数がとても小さい（0.001x³ − x、根が遠い）→ 計算が成功する（Task 2「最高次の係数が小さい」）。
3. スライダーを動かし続ける（8次・係数が大きい）→ 1回の計算が 100ms 以内（Task 2「8次で係数が大きくても…」）。
4. 最高次の係数欄に 0 を入れる → 警告を出し、直前の図を残す（Task 3 の確認手順 5）。
5. 係数欄を空にする・数値でない文字を入れる → 無視して落ちない（Task 3 の確認手順 6）。

---

## File Structure

| ファイル | 役割 |
|---|---|
| `core.js` | 複素数・多項式・根（Aberth 法）・重根のまとめ・曲線の追跡・色番号・検算。`Decaus.compute(coeffs)` |
| `tests/core.test.js` | core.js のテスト（`node:test`） |
| `index.html` | 画面の骨組み（操作パネルと Canvas）、スタイル |
| `view.js` | プリセット・入力欄の配線、平行投影、箱での切り取り、描画、回転・拡大 |
| `README.md` | 使い方 |
| `HANDOFF.md` | 進み具合と決定事項（正） |

開発用サーバは `D:\claude_code\.claude\launch.json` の `decaus-http`（ポート 8770、`D:/claude_code/decaus` を配信）。設定済み。

---

### Task 1: 複素数・多項式・根と重根のまとめ

**Files:**
- Create: `core.js`
- Test: `tests/core.test.js`

**Interfaces:**
- Consumes: なし
- Produces: `Decaus._internal = { C, evalC, deriv, normAt, roots, clusterRoots }`
  - `C(re, im) → {re, im}`
  - `evalC(p: number[], z: {re,im}) → {re,im}`（p は高次から）
  - `deriv(p: number[]) → number[]`
  - `normAt(p, z) → number`（Σ|a_i|·max(1,|z|)^(n−i)、相対誤差の基準）
  - `roots(p) → {re,im}[]`（長さ = 次数）
  - `clusterRoots(p, zs, L) → [{x: {re,im}, m: int}]`（m は重複度、|Im x| ≤ 1e-9·L なら x.im は厳密に 0）

- [ ] **Step 1: 作業ブランチを切る**

```bash
cd /d/claude_code/decaus && git checkout -b feat/viewer
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/core.test.js` を作る：

```js
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
```

- [ ] **Step 3: テストが失敗することを確かめる**

Run: `/d/node-v24.20.0-win-x64/node.exe --test tests/core.test.js`
Expected: FAIL（`Cannot find module '../core.js'`）

- [ ] **Step 4: core.js を書く**

`core.js` を作る：

```js
/* デカウス空間：実係数多項式 y = f(x) について、f(x) が実数となる複素数 x の集合を求める。
   DOM には触れない。ブラウザでは window.Decaus、Node では module.exports。 */
(function () {
  'use strict';

  const PI = Math.PI;

  // ---- 複素数 {re, im} ----
  const C = (re, im) => ({ re: re, im: im || 0 });
  const add = (a, b) => C(a.re + b.re, a.im + b.im);
  const sub = (a, b) => C(a.re - b.re, a.im - b.im);
  const scale = (a, s) => C(a.re * s, a.im * s);
  const conj = (a) => C(a.re, -a.im);
  const abs = (a) => Math.hypot(a.re, a.im);
  const expi = (t) => C(Math.cos(t), Math.sin(t));
  function div(a, b) {
    const d = b.re * b.re + b.im * b.im;
    return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
  }

  // ---- 多項式（係数は高次から [a_n, ..., a_0]、実数）----
  function evalC(p, z) {
    let re = p[0], im = 0;
    for (let i = 1; i < p.length; i++) {
      const t = re * z.re - im * z.im + p[i];
      im = re * z.im + im * z.re;
      re = t;
    }
    return C(re, im);
  }
  function deriv(p) {
    const n = p.length - 1, q = [];
    for (let i = 0; i < n; i++) q.push(p[i] * (n - i));
    return q;
  }
  // 相対誤差の基準：Σ|a_i|·max(1,|z|)^(n−i)
  function normAt(p, z) {
    const r = Math.max(1, abs(z));
    let s = 0;
    for (let i = 0; i < p.length; i++) s = s * r + Math.abs(p[i]);
    return s;
  }

  // ---- 根（Aberth 法）。末尾の 0 係数は厳密な根 0 として先に外す ----
  function roots(p) {
    const out = [], q = p.slice();
    while (q.length > 1 && q[q.length - 1] === 0) { q.pop(); out.push(C(0, 0)); }
    const n = q.length - 1;
    if (n === 0) return out;
    if (n === 1) { out.push(C(-q[1] / q[0], 0)); return out; }
    let r = 0;
    for (let i = 1; i <= n; i++) r = Math.max(r, Math.pow(Math.abs(q[i] / q[0]), 1 / i));
    const dq = deriv(q), z = [];
    for (let k = 0; k < n; k++) z.push(scale(expi(2 * PI * k / n + 0.4), r));
    for (let it = 0; it < 2000; it++) {
      let done = true;
      for (let k = 0; k < n; k++) {
        const pz = evalC(q, z[k]);
        if (pz.re === 0 && pz.im === 0) continue;
        const ratio = div(evalC(dq, z[k]), pz);
        let s = C(0, 0);
        for (let j = 0; j < n; j++) if (j !== k) s = add(s, div(C(1, 0), sub(z[k], z[j])));
        const off = div(C(1, 0), sub(ratio, s));
        if (!isFinite(off.re) || !isFinite(off.im)) continue;
        z[k] = sub(z[k], off);
        if (abs(off) > 1e-15 * (1 + abs(z[k]))) done = false;
      }
      if (done) break;
    }
    return out.concat(z);
  }

  // ---- 近い根を集めて重根にまとめる ----
  // Aberth 法は k 重根を半径 ε^(1/k) 程度にばらけて返し、平均もその程度しか合わない。
  // k 重根は p^(k−1) の単根なので、平均点から Newton 法で磨いてから、
  // p, p′, …, p^(k−2) が 0 になるかを厳しく確かめる（別々の根を誤ってまとめる距離は約 1e-6）。
  function clusterRoots(p, zs, L) {
    const out = [];
    function group(list, rad) {
      const groups = [], used = list.map(() => false);
      for (let i = 0; i < list.length; i++) {
        if (used[i]) continue;
        const cur = [list[i]];
        used[i] = true;
        for (let a = 0; a < cur.length; a++)
          for (let j = 0; j < list.length; j++)
            if (!used[j] && abs(sub(cur[a], list[j])) <= rad) { used[j] = true; cur.push(list[j]); }
        groups.push(cur);
      }
      return groups;
    }
    function refine(c, k) {
      let q = p;
      for (let j = 0; j < k - 1; j++) q = deriv(q);
      const dq = deriv(q);
      for (let it = 0; it < 50; it++) {
        const s = div(evalC(q, c), evalC(dq, c));
        if (!isFinite(s.re) || !isFinite(s.im)) break;
        c = sub(c, s);
        if (abs(s) <= 1e-16 * (1 + abs(c))) break;
      }
      return c;
    }
    function isMultiple(c, k) {
      let q = p;
      for (let j = 0; j < k - 1; j++) {
        if (abs(evalC(q, c)) > 1e-12 * normAt(q, c)) return false;
        q = deriv(q);
      }
      return true;
    }
    function rec(list, rad) {
      for (const g of group(list, rad)) {
        if (g.length === 1) { out.push({ x: g[0], m: 1 }); continue; }
        let mean = C(0, 0);
        for (const z of g) mean = add(mean, z);
        mean = scale(mean, 1 / g.length);
        const c = refine(mean, g.length);
        if (abs(sub(c, mean)) <= rad && isMultiple(c, g.length)) out.push({ x: c, m: g.length });
        else if (rad < 1e-9 * L) for (const z of g) out.push({ x: z, m: 1 });
        else rec(g, rad / 10);
      }
    }
    rec(zs, 1e-3 * L);
    for (const r of out) if (Math.abs(r.x.im) <= 1e-9 * L) r.x = C(r.x.re, 0);
    return out;
  }

  const Decaus = {
    _internal: { C: C, evalC: evalC, deriv: deriv, normAt: normAt, roots: roots, clusterRoots: clusterRoots },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Decaus;
  else window.Decaus = Decaus;
})();
```

（`conj` はこの段階では未使用。Task 2 で使う。）

- [ ] **Step 5: テストが通ることを確かめる**

Run: `/d/node-v24.20.0-win-x64/node.exe --test tests/core.test.js`
Expected: `ℹ pass 8`、`ℹ fail 0`

- [ ] **Step 6: コミット**

```bash
cd /d/claude_code/decaus && git add core.js tests/core.test.js && git commit -m "feat: 複素数・多項式・Aberth 法の根と重根のまとめ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 曲線の追跡・通り抜け・色番号・検算（Decaus.compute）

**Files:**
- Modify: `core.js`（末尾の `const Decaus = {` から最後まで）
- Test: `tests/core.test.js`（末尾に追記）

**Interfaces:**
- Consumes: Task 1 の `C, add, sub, scale, conj, abs, expi, div, evalC, deriv, normAt, roots, clusterRoots, PI`（同じ IIFE 内）
- Produces: `Decaus.compute(coeffs: number[]) →`
  ```
  {
    strands: [{ real: bool, colorIndex: int|null, ends: [k1, k2], points: [[Re x, Im x, y], ...] }],
    roots: [{re, im}],            // f(x) = 0 の解
    centroid: number,             // −a_{n−1} / (n·a_n)
    vertices: [{ x: {re, im}, y: number, m: int }],  // f(c) が実数の臨界点、m は f′ の零点としての重複度
    degenerate: bool,             // m ≥ 2 の頂点、または非実の頂点があるか
    check: { ok: bool, message: string }
  }
  ```
  - 入力が不正なら `Error` を投げる。メッセージは「次数は 1〜8 にしてください」「係数が数値ではありません」「最高次の係数が 0 です」。
  - 漸近方向の番号 k（0 … 2n−1）は偏角 θ_k = (kπ − arg a_n)/n。実曲線の端は a_n > 0 なら {0, n}、a_n < 0 なら {1, n+1 mod 2n}。
  - 頂点上の点は `[V.x.re, V.x.im, V.y]` と厳密に同じ値で strand の points に入る（view.js やテストが頂点の判定に使う）。

- [ ] **Step 1: 失敗するテストを書く**

`tests/core.test.js` の末尾に追記する：

```js
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
```

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `/d/node-v24.20.0-win-x64/node.exe --test tests/core.test.js`
Expected: Task 1 の 8 件は pass、追記した 18 件は FAIL（`D.compute is not a function`）

- [ ] **Step 3: compute を実装する**

`core.js` の次の部分（Task 1 の末尾）：

```js
  const Decaus = {
    _internal: { C: C, evalC: evalC, deriv: deriv, normAt: normAt, roots: roots, clusterRoots: clusterRoots },
  };
```

を、次で置き換える（`if (typeof module …` 以降の2行と `})();` はそのまま残す）：

```js
  function validate(coeffs) {
    if (!Array.isArray(coeffs) || coeffs.length < 2 || coeffs.length > 9)
      throw new Error('次数は 1〜8 にしてください');
    for (const a of coeffs) if (typeof a !== 'number' || !isFinite(a)) throw new Error('係数が数値ではありません');
    if (coeffs[0] === 0) throw new Error('最高次の係数が 0 です');
  }

  const wrap = (j, N) => ((j % N) + N) % N;

  function computeOnce(p, hf) {
    const n = p.length - 1, dp = deriv(p);
    const fr = roots(p);
    let rmax = 0;
    for (const z of fr) rmax = Math.max(rmax, abs(z));
    const L = 1 + rmax;
    const crit = n >= 2 ? clusterRoots(dp, roots(dp), L) : [];
    const critPts = crit.map((c) => c.x);
    const argA = p[0] > 0 ? 0 : PI, k0 = p[0] > 0 ? 0 : 1, k0n = wrap(k0 + n, 2 * n);
    // 根をすべて含む円上では arg f が単調に 2πn 増える。半径を十分取れば、
    // 漸近方向 θ_k = (kπ − arg a)/n の ±π/(2n) にちょうど1つずつ曲線が通る。
    const Rfar = (2 / Math.sin(PI / (2 * n))) * Math.max(rmax, 1);
    const Rexit = 1.05 * Rfar;
    const yScale = 1 + Math.max(Math.abs(evalC(p, C(L, 0)).re), Math.abs(evalC(p, C(-L, 0)).re));

    // 頂点：f(c) が実数の臨界点。局所形 f ≈ f(c) + K (x − c)^(m+1)
    const verts = [];
    crit.forEach((cr, idx) => {
      const fc = evalC(p, cr.x);
      if (!(cr.x.im === 0 || Math.abs(fc.im) <= 1e-10 * normAt(p, cr.x))) return;
      let q = p, fact = 1;
      for (let j = 0; j <= cr.m; j++) { q = deriv(q); fact *= j + 1; }
      const K = scale(evalC(q, cr.x), 1 / fact);
      const argK = K.im === 0 ? (K.re > 0 ? 0 : PI) : Math.atan2(K.im, K.re);
      let dnear = L;
      crit.forEach((o, i2) => { if (i2 !== idx) dnear = Math.min(dnear, abs(sub(o.x, cr.x))); });
      verts.push({ x: cr.x, y: fc.re, m: cr.m, argK: argK, rs: 0.02 * dnear });
    });

    function distCrit(x) {
      let d = Infinity;
      for (const c of critPts) d = Math.min(d, abs(sub(x, c)));
      return d;
    }
    // 目標値 Re f を保ったまま Im f を 0 にする Newton 法：x ← x − i·Im f / f′
    function newton(x) {
      for (let it = 0; it < 12; it++) {
        const fx = evalC(p, x);
        if (Math.abs(fx.im) <= 1e-13 * normAt(p, x)) return x;
        x = sub(x, div(C(0, fx.im), evalC(dp, x)));
      }
      return null;
    }

    // 曲線上では f′·dx が実数 → 進行方向は σ·conj(f′)。σ = +1 なら y が増える向き。
    // 歩幅は最も近い臨界点までの距離 d の hf 倍以下（Grace–Heawood により別の枝へ移らない）。
    function trace(x, sigma, fromV) {
      const pts = [];
      let y = evalC(p, x).re;
      pts.push([x.re, x.im, y]);
      for (let step = 0; step < 200000; step++) {
        const ax = abs(x), d1 = evalC(dp, x), ad1 = abs(d1);
        let h = Math.min(hf * distCrit(x), ax > 3 * L ? hf * ax : 0.02 * L);
        if (Math.abs(y) <= 10 * yScale) h = Math.min(h, 0.02 * yScale / ad1);
        const dir = scale(conj(d1), sigma / ad1);
        let nx = null;
        for (let tries = 0; tries < 30 && !nx; tries++, h /= 2) {
          const cand = newton(add(x, scale(dir, h)));
          if (cand && sigma * (evalC(p, cand).re - y) > 0 && abs(sub(cand, x)) <= 3 * h) nx = cand;
        }
        if (!nx) return { fail: '曲線を追えませんでした' };
        x = nx;
        y = evalC(p, x).re;
        pts.push([x.re, x.im, y]);
        for (let v = 0; v < verts.length; v++) {
          if (v === fromV) continue;
          const V = verts[v], dv = sub(x, V.x);
          if (abs(dv) >= V.rs) continue;
          const M = V.m + 1;
          const j = wrap(Math.round((M * Math.atan2(dv.im, dv.re) + V.argK) / PI), 2 * M);
          // 頂点へ向かって y が増えるのは、外向きに y が減る枝（j が奇数）
          if ((sigma === 1) !== (j % 2 === 1)) return { fail: '頂点の枝の向きが合いません' };
          pts.push([V.x.re, V.x.im, V.y]);
          return { pts: pts, end: 'v' + v + ':' + j };
        }
        if (abs(x) > Rexit) {
          const k = wrap(Math.round((n * Math.atan2(x.im, x.re) + argA) / PI), 2 * n);
          return { pts: pts, end: 'i' + k };
        }
      }
      return { fail: '歩数の上限に達しました' };
    }

    function farStart(k) {
      if (k === k0) return C(Rfar, 0);
      if (k === k0n) return C(-Rfar, 0);
      const th = (k * PI - argA) / n, w = PI / (2 * n), sgn = k % 2 === 0 ? 1 : -1;
      const g = (t) => sgn * evalC(p, scale(expi(t), Rfar)).im;
      let lo = th - w, hi = th + w;
      if (!(g(lo) < 0 && g(hi) > 0)) return null;
      for (let it = 0; it < 60; it++) {
        const mid = (lo + hi) / 2;
        if (g(mid) < 0) lo = mid; else hi = mid;
      }
      return newton(scale(expi((lo + hi) / 2), Rfar));
    }

    const arcs = [], owner = {};
    let fail = null;
    function addArc(a, r) {
      if (fail) return;
      if (r.fail) { fail = r.fail; return; }
      if (owner[a] || owner[r.end]) { fail = '同じ端に2本の枝が来ました'; return; }
      arcs.push({ a: a, b: r.end, pts: r.pts, real: r.pts.every((q) => q[1] === 0) });
      owner[a] = { idx: arcs.length - 1, side: 'a' };
      owner[r.end] = { idx: arcs.length - 1, side: 'b' };
    }

    for (let k = 0; k < 2 * n && !fail; k++) {
      if (owner['i' + k]) continue;
      const x0 = farStart(k);
      if (!x0) { fail = '遠方の始点が見つかりません'; break; }
      const d1 = evalC(dp, x0);
      const sigma = x0.re * d1.re - x0.im * d1.im < 0 ? 1 : -1; // conj(f′) が内向きなら +1
      addArc('i' + k, trace(x0, sigma, -1));
    }
    verts.forEach((V, vi) => {
      const M = V.m + 1;
      for (let j = 0; j < 2 * M && !fail; j++) {
        const key = 'v' + vi + ':' + j;
        if (owner[key]) continue;
        let e = expi((j * PI - V.argK) / M);
        if (V.x.im === 0 && Math.abs(e.im) < 1e-12) e = C(Math.sign(e.re), 0);
        const x0 = newton(add(V.x, scale(e, V.rs)));
        if (!x0) { fail = '頂点からの始点が見つかりません'; break; }
        const r = trace(x0, j % 2 === 0 ? 1 : -1, vi);
        if (r.pts) r.pts.unshift([V.x.re, V.x.im, V.y]);
        addArc(key, r);
      }
    });

    // 頂点では向かい合う枝（j と j+M）をつなぐ＝通り抜けの規則
    const strands = [];
    if (!fail) {
      const used = arcs.map(() => false);
      for (let k = 0; k < 2 * n && !fail; k++) {
        if (used[owner['i' + k].idx]) continue;
        let cur = 'i' + k, pts = [], real = true;
        for (;;) {
          const o = owner[cur];
          if (!o) { fail = '枝 ' + cur + ' がありません'; break; }
          if (used[o.idx]) { fail = '同じ枝を2度通りました'; break; }
          used[o.idx] = true;
          const arc = arcs[o.idx];
          let seq = o.side === 'a' ? arc.pts : arc.pts.slice().reverse();
          if (pts.length) seq = seq.slice(1);
          pts = pts.concat(seq);
          real = real && arc.real;
          const other = o.side === 'a' ? arc.b : arc.a;
          if (other[0] === 'i') {
            strands.push({ real: real, colorIndex: null, ends: [k, +other.slice(1)], points: pts });
            break;
          }
          const [vi, j] = other.slice(1).split(':').map(Number), M = verts[vi].m + 1;
          cur = 'v' + vi + ':' + ((j + M) % (2 * M));
        }
      }
      if (!fail && used.some((u) => !u)) fail = '使われない枝があります';
    }

    if (!fail) {
      const cnt = new Array(2 * n).fill(0);
      for (const s of strands) { cnt[s.ends[0]]++; cnt[s.ends[1]]++; }
      const reals = strands.filter((s) => s.real);
      if (cnt.some((c) => c !== 1)) fail = '漸近方向ごとの端の数が 1 ではありません';
      else if (reals.length !== 1) fail = '実曲線が 1 本ではありません';
      else {
        const e = reals[0].ends.slice().sort((a, b) => a - b);
        if (e[0] !== Math.min(k0, k0n) || e[1] !== Math.max(k0, k0n)) fail = '実曲線の端が実軸上にありません';
      }
    }

    strands.filter((s) => !s.real)
      .sort((a, b) => Math.min(a.ends[0], a.ends[1]) - Math.min(b.ends[0], b.ends[1]))
      .forEach((s, i) => { s.colorIndex = i; });

    return {
      strands: strands,
      roots: fr,
      centroid: -p[1] / (n * p[0]),
      vertices: verts.map((V) => ({ x: V.x, y: V.y, m: V.m })),
      degenerate: verts.some((V) => V.m >= 2 || V.x.im !== 0),
      check: { ok: !fail, message: fail || '' },
    };
  }

  function compute(coeffs) {
    validate(coeffs);
    let res = null;
    for (let hf = 0.1; hf >= 0.0125; hf /= 2) {
      res = computeOnce(coeffs, hf);
      if (res.check.ok) break;
    }
    return res;
  }

  const Decaus = {
    compute: compute,
    _internal: { C: C, evalC: evalC, deriv: deriv, normAt: normAt, roots: roots, clusterRoots: clusterRoots },
  };
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `/d/node-v24.20.0-win-x64/node.exe --test tests/core.test.js`
Expected: `ℹ pass 26`、`ℹ fail 0`

- [ ] **Step 5: コミット**

```bash
cd /d/claude_code/decaus && git add core.js tests/core.test.js && git commit -m "feat: 曲線の追跡・通り抜けの規則・色番号・検算（Decaus.compute）

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 画面・描画・操作と説明書き

**Files:**
- Create: `index.html`, `view.js`, `README.md`, `HANDOFF.md`

**Interfaces:**
- Consumes: `window.Decaus.compute(coeffs)`（Task 2 の戻り値の形）
- Produces: ブラウザで開くアプリ（`index.html`）

- [ ] **Step 1: index.html を書く**

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>デカウス空間ビューア</title>
<style>
  :root { --fg: #222; --muted: #666; --line: #ccc; --panel: #f6f6f4; --warn: #b03000; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: #fff; color: var(--fg);
    font-family: system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", sans-serif; font-size: 14px; }
  #app { display: flex; height: 100%; }
  #panel { width: 320px; flex: none; overflow-y: auto; padding: 12px 16px; background: var(--panel); border-right: 1px solid var(--line); }
  #stage { flex: 1; position: relative; min-width: 0; }
  #cv { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none; cursor: grab; }
  h1 { font-size: 17px; margin: 0 0 4px; }
  h2 { font-size: 13px; margin: 14px 0 6px; color: var(--muted); font-weight: 600; }
  #formula { font-family: "Cambria Math", "Times New Roman", serif; font-size: 17px; margin: 6px 0 2px; }
  .row { display: flex; align-items: center; gap: 6px; margin: 4px 0; }
  .row label { width: 64px; flex: none; }
  .row input[type=number] { width: 78px; }
  .row input[type=range] { flex: 1; min-width: 0; }
  .btns { display: flex; gap: 6px; flex-wrap: wrap; }
  button, select { font: inherit; }
  .checks label { display: block; margin: 2px 0; }
  #info { font-family: ui-monospace, Consolas, monospace; font-size: 12px; white-space: pre-wrap; }
  #warn { color: var(--warn); margin-top: 6px; white-space: pre-wrap; }
  @media (max-width: 760px) {
    #app { flex-direction: column; height: auto; }
    #panel { width: 100%; border-right: none; border-bottom: 1px solid var(--line); }
    #stage { height: 75vh; }
  }
</style>
</head>
<body>
<div id="app">
  <div id="panel">
    <h1>デカウス空間ビューア</h1>
    <div id="formula"></div>

    <h2>プリセット</h2>
    <select id="preset"></select>

    <h2>次数と係数</h2>
    <div class="row"><label for="degree">次数 n</label><select id="degree"></select></div>
    <div id="coeffs"></div>

    <h2>表示</h2>
    <div class="checks">
      <label><input type="checkbox" id="showAxes" checked> 軸</label>
      <label><input type="checkbox" id="showPlane" checked> ガウス平面（y = 0）</label>
      <label><input type="checkbox" id="showRoots" checked> 解</label>
      <label><input type="checkbox" id="showCentroid" checked> 解の重心</label>
      <label><input type="checkbox" id="showVertices" checked> 臨界点</label>
    </div>

    <h2>視点</h2>
    <div class="btns">
      <button id="viewOblique">斜め</button>
      <button id="viewTop">真上</button>
      <button id="viewSide">真横</button>
    </div>

    <h2>表示範囲</h2>
    <div class="row"><label for="rangeR">x 半幅 R</label><input type="number" id="rangeR" step="any" min="0"></div>
    <div class="row"><label for="rangeY">y 範囲 ±Y</label><input type="number" id="rangeY" step="any" min="0"></div>
    <div class="btns"><button id="rangeAuto">自動</button></div>

    <h2>状態</h2>
    <div id="info"></div>
    <div id="warn"></div>
  </div>
  <div id="stage"><canvas id="cv"></canvas></div>
</div>
<script src="core.js"></script>
<script src="view.js"></script>
</body>
</html>
```

- [ ] **Step 2: view.js を書く**

```js
/* デカウス空間ビューア：投影・描画・操作。計算は core.js（window.Decaus）。 */
(function () {
  'use strict';

  const PI = Math.PI;
  const PALETTE = ['#d62728', '#1f5fd6', '#2ca02c', '#ff7f0e', '#9467bd', '#17a2a2', '#8c564b'];
  const PRESETS = [
    { name: '2次（虚数解）', c: [1, -2, 2] },
    { name: '基本形3次', c: [1, 0, 0, 0] },
    { name: '基本形4次', c: [1, 0, 0, 0, 0] },
    { name: '3次・極値2つ', c: [1, 0, -3, 0] },
    { name: '4次・極値3つ', c: [1, 0, -2, 0, 0] },
    { name: '4次・極値＋変曲点', c: [1, 4 / 3, 0, 0, 0] },
  ];
  const VIEWS = { oblique: { az: -0.55, el: 0.42 }, top: { az: 0, el: PI / 2 }, side: { az: 0, el: 0 } };
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸';

  const state = {
    coeffs: PRESETS[3].c.slice(),
    az: VIEWS.oblique.az, el: VIEWS.oblique.el, zoom: 1,
    auto: true, R: 2, Y: 2,
    result: null, error: '',
  };

  const $ = (id) => document.getElementById(id);
  const cv = $('cv'), ctx = cv.getContext('2d');

  // ---- 数式と数値の表示 ----
  const fmt = (a) => String(parseFloat(a.toFixed(4)));
  function formula(c) {
    const n = c.length - 1;
    let s = '';
    c.forEach((a, i) => {
      const k = n - i;
      if (a === 0) return;
      const mag = Math.abs(a);
      const num = mag === 1 && k > 0 ? '' : fmt(mag);
      const pow = k === 0 ? '' : k === 1 ? 'x' : 'x' + SUP[k];
      s += (s === '' ? (a < 0 ? '−' : '') : a < 0 ? ' − ' : ' + ') + num + pow;
    });
    return 'y = ' + s;
  }
  function fmtC(z) {
    const re = fmt(z.re), im = Math.abs(z.im) < 5e-5 ? 0 : z.im;
    if (im === 0) return re;
    return re + (im < 0 ? ' − ' : ' + ') + fmt(Math.abs(im)) + 'i';
  }

  // ---- 計算と表示範囲 ----
  function recompute() {
    try {
      state.result = Decaus.compute(state.coeffs);
      state.error = '';
    } catch (e) {
      state.error = e.message; // 直前の図は残す
    }
    if (state.auto) autoRange();
    updateInfo();
    requestDraw();
  }
  function autoRange() {
    const r = state.result;
    if (!r) return;
    let m = 1;
    for (const z of r.roots) m = Math.max(m, Math.hypot(z.re, z.im));
    for (const v of r.vertices) m = Math.max(m, Math.hypot(v.x.re, v.x.im));
    state.R = 1.3 * m;
    // y は実曲線（|x| ≤ R の部分）と頂点で決める。虚曲線は箱の上下で切れてよい（添付図と同じ見え方）
    let ym = 0;
    for (const s of r.strands)
      if (s.real) for (const q of s.points) if (Math.abs(q[0]) <= state.R) ym = Math.max(ym, Math.abs(q[2]));
    for (const v of r.vertices) ym = Math.max(ym, Math.abs(v.y));
    state.Y = ym > 0 ? 1.1 * ym : 1;
    $('rangeR').value = +state.R.toPrecision(4);
    $('rangeY').value = +state.Y.toPrecision(4);
  }

  // ---- 投影（正規化した箱 [-1,1]^3 → 画面、平行投影）----
  // u = Re x / R, v = Im x / R, w = y / Y。az は鉛直軸まわり、el は仰角。
  let W = 0, H = 0, dpr = 1;
  function proj(q) {
    const ca = Math.cos(state.az), sa = Math.sin(state.az), ce = Math.cos(state.el), se = Math.sin(state.el);
    const X = q[0] * ca + q[1] * sa;
    const V = -q[0] * sa + q[1] * ca;
    const U = q[2] * ce + V * se;
    const s = state.zoom * Math.min(W, H) * 0.32;
    return [W / 2 + X * s, H / 2 - U * s];
  }
  const norm = (q) => [q[0] / state.R, q[1] / state.R, q[2] / state.Y];

  // 線分を箱 [-1,1]^3 で切る（Liang–Barsky）。[始点, 終点, 始点を切ったか, 終点を切ったか]
  function clip(a, b) {
    let t0 = 0, t1 = 1;
    for (let i = 0; i < 3; i++) {
      const d = b[i] - a[i];
      const pq = [[-d, a[i] + 1], [d, 1 - a[i]]];
      for (const [pp, qq] of pq) {
        if (pp === 0) { if (qq < 0) return null; continue; }
        const r = qq / pp;
        if (pp < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
        else { if (r < t0) return null; if (r < t1) t1 = r; }
      }
    }
    const at = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    return [at(t0), at(t1), t0 > 0, t1 < 1];
  }
  function polyline(pts) {
    ctx.beginPath();
    let pen = false;
    for (let i = 1; i < pts.length; i++) {
      const c = clip(norm(pts[i - 1]), norm(pts[i]));
      if (!c) { pen = false; continue; }
      const A = proj(c[0]), B = proj(c[1]);
      if (!pen || c[2]) ctx.moveTo(A[0], A[1]);
      ctx.lineTo(B[0], B[1]);
      pen = !c[3];
    }
    ctx.stroke();
  }
  function line3(a, b) {
    const A = proj(a), B = proj(b);
    ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
  }
  function label(q, text) {
    const P = proj(q);
    ctx.fillText(text, P[0] + 4, P[1] - 4);
  }

  // ---- 描画 ----
  let pending = false;
  function requestDraw() {
    if (!pending) { pending = true; requestAnimationFrame(draw); }
  }
  function draw() {
    pending = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.font = '13px system-ui, sans-serif';

    // 箱
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1;
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      line3([-1, a, b], [1, a, b]); line3([a, -1, b], [a, 1, b]); line3([a, b, -1], [a, b, 1]);
    }
    if ($('showPlane').checked) {
      ctx.fillStyle = 'rgba(70,110,200,0.07)';
      ctx.beginPath();
      [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]].forEach((q, i) => {
        const P = proj(q); i ? ctx.lineTo(P[0], P[1]) : ctx.moveTo(P[0], P[1]);
      });
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(70,110,200,0.22)';
      for (let i = -4; i <= 4; i++) { line3([i / 4, -1, 0], [i / 4, 1, 0]); line3([-1, i / 4, 0], [1, i / 4, 0]); }
    }
    if ($('showAxes').checked) {
      ctx.strokeStyle = '#888'; ctx.fillStyle = '#555'; ctx.lineWidth = 1;
      line3([-1, 0, 0], [1, 0, 0]); line3([0, -1, 0], [0, 1, 0]); line3([0, 0, -1], [0, 0, 1]);
      label([1, 0, 0], 'Xr'); label([0, 1, 0], 'Xi'); label([0, 0, 1], 'Y');
    }

    const r = state.result;
    if (r) {
      ctx.lineWidth = 2;
      for (const s of r.strands) {
        if (s.real) continue;
        ctx.strokeStyle = PALETTE[s.colorIndex % PALETTE.length];
        polyline(s.points);
      }
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      for (const s of r.strands) if (s.real) polyline(s.points);

      if ($('showCentroid').checked) {
        const u = r.centroid / state.R;
        if (Math.abs(u) <= 1) {
          ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
          line3([u, 0, -1], [u, 0, 1]);
          ctx.setLineDash([]);
          ctx.fillStyle = '#555'; label([u, 0, 1], '重心');
        }
      }
      if ($('showRoots').checked) {
        ctx.fillStyle = '#111';
        for (const z of r.roots) {
          const q = norm([z.re, z.im, 0]);
          if (Math.abs(q[0]) > 1 || Math.abs(q[1]) > 1) continue;
          const P = proj(q);
          ctx.beginPath(); ctx.arc(P[0], P[1], 4, 0, 2 * PI); ctx.fill();
        }
      }
      if ($('showVertices').checked) {
        ctx.strokeStyle = '#111'; ctx.fillStyle = '#fff'; ctx.lineWidth = 1.5;
        for (const v of r.vertices) {
          const q = norm([v.x.re, v.x.im, v.y]);
          if (q.some((t) => Math.abs(t) > 1)) continue;
          const P = proj(q);
          ctx.beginPath(); ctx.arc(P[0], P[1], 5, 0, 2 * PI); ctx.fill(); ctx.stroke();
        }
      }
    }
  }

  function updateInfo() {
    $('formula').textContent = formula(state.coeffs);
    const r = state.result;
    let info = '';
    if (r) {
      info += '解（f(x) = 0）\n' + r.roots.map((z) => '  ' + fmtC(z)).join('\n') + '\n';
      info += '解の重心  ' + fmt(r.centroid) + '\n';
      info += '臨界点（頂点）\n' + (r.vertices.length
        ? r.vertices.map((v) => '  x = ' + fmtC(v.x) + ', y = ' + fmt(v.y) + (v.m > 1 ? '（' + (v.m + 1) + '重の交差）' : '')).join('\n')
        : '  なし');
    }
    $('info').textContent = info;
    const w = [];
    if (state.error) w.push(state.error + '（直前の図を表示しています）');
    if (r && !r.check.ok) w.push('検算に失敗：' + r.check.message);
    if (r && r.degenerate) w.push('退化点あり：通り抜けの規則で色を付けています');
    $('warn').textContent = w.join('\n');
  }

  // ---- 入力欄 ----
  function buildCoeffRows() {
    const box = $('coeffs'), n = state.coeffs.length - 1;
    box.textContent = '';
    state.coeffs.forEach((a, i) => {
      const k = n - i;
      const row = document.createElement('div');
      row.className = 'row';
      const lab = document.createElement('label');
      lab.textContent = 'a' + k + (k === 0 ? '' : k === 1 ? '  x' : '  x' + SUP[k]);
      const num = document.createElement('input');
      num.type = 'number'; num.step = 'any'; num.value = a;
      const rng = document.createElement('input');
      rng.type = 'range'; rng.min = -5; rng.max = 5; rng.step = 0.01; rng.value = a;
      num.addEventListener('input', () => {
        const v = parseFloat(num.value);
        if (!isFinite(v)) return;
        state.coeffs[i] = v; rng.value = v; recompute();
      });
      rng.addEventListener('input', () => {
        const v = parseFloat(rng.value);
        state.coeffs[i] = v; num.value = v; recompute();
      });
      row.append(lab, num, rng);
      box.append(row);
    });
    $('degree').value = n;
  }
  function setDegree(n) {
    const old = state.coeffs, on = old.length - 1, c = [];
    for (let k = n; k >= 0; k--) c.push(k <= on ? old[on - k] : 0);
    if (c[0] === 0) c[0] = 1;
    state.coeffs = c;
    buildCoeffRows();
    recompute();
  }
  function setView(v) {
    state.az = v.az; state.el = v.el; state.zoom = 1; requestDraw();
  }

  function init() {
    const ps = $('preset');
    PRESETS.forEach((p, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = p.name + '　' + formula(p.c).slice(4);
      ps.append(o);
    });
    ps.value = 3;
    ps.addEventListener('change', () => {
      state.coeffs = PRESETS[+ps.value].c.slice();
      state.auto = true;
      buildCoeffRows(); recompute();
    });
    for (let n = 1; n <= 8; n++) {
      const o = document.createElement('option');
      o.value = n; o.textContent = n; $('degree').append(o);
    }
    $('degree').addEventListener('change', () => setDegree(+$('degree').value));
    ['showAxes', 'showPlane', 'showRoots', 'showCentroid', 'showVertices']
      .forEach((id) => $(id).addEventListener('change', requestDraw));
    $('viewOblique').addEventListener('click', () => setView(VIEWS.oblique));
    $('viewTop').addEventListener('click', () => setView(VIEWS.top));
    $('viewSide').addEventListener('click', () => setView(VIEWS.side));
    for (const id of ['rangeR', 'rangeY']) {
      $(id).addEventListener('input', () => {
        const v = parseFloat($(id).value);
        if (!(v > 0)) return;
        state.auto = false;
        if (id === 'rangeR') state.R = v; else state.Y = v;
        requestDraw();
      });
    }
    $('rangeAuto').addEventListener('click', () => { state.auto = true; autoRange(); requestDraw(); });

    // 回転・拡大
    let drag = null;
    cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      state.az -= (e.clientX - drag.x) * 0.01;
      state.el = Math.max(-PI / 2, Math.min(PI / 2, state.el + (e.clientY - drag.y) * 0.01));
      drag = { x: e.clientX, y: e.clientY };
      requestDraw();
    });
    const end = () => { drag = null; cv.style.cursor = 'grab'; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      state.zoom = Math.max(0.2, Math.min(20, state.zoom * Math.exp(-e.deltaY * 0.001)));
      requestDraw();
    }, { passive: false });

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      requestDraw();
    };
    new ResizeObserver(resize).observe($('stage'));
    resize();

    buildCoeffRows();
    recompute();
  }

  init();
})();
```

- [ ] **Step 3: README.md と HANDOFF.md を書く**

`README.md`：

```markdown
# デカウス空間ビューア

実係数の多項式 y = f(x) について、x を複素数に広げたときに y が実数になる点の集合
（デカウス曲線）を、3次元空間（Re x, Im x, y）に描いて回して見るアプリです。

出典：加藤「思索の散歩道 — デカウス空間」 https://kato.chobi.net/descaus/index.html

## 使い方

`index.html` をブラウザで開く（サーバ不要、外部ライブラリなし）。

- プリセットか、次数と係数（数値欄・スライダー）で多項式を決める。
- ドラッグで回転、ホイールで拡大縮小。「真上」「真横」「斜め」で視点を切り替える。
- 実曲線は黒、虚曲線は色付き。真上から見て（ガウス平面に落として）一本につながる曲線は同じ色。
- 臨界点が重なる退化点では「通り抜けの規則」で色を付ける。係数を少し動かすと色の組み合わせが変わることがある（仕様）。

## テスト

    D:\node-v24.20.0-win-x64\node.exe --test tests/core.test.js

## 文書

- 設計書：`docs/superpowers/specs/2026-10-11-decaus-viewer-design.md`
- 実装計画：`docs/superpowers/plans/2026-10-11-decaus-viewer.md`
- 進み具合と決定事項：`HANDOFF.md`
```

`HANDOFF.md`：

```markdown
# HANDOFF（デカウス空間ビューア）

この文書が進み具合と決定事項の正。

## 現状（2026-10-11）

- 第1版の実装が完了（core.js・view.js・index.html、テスト 26 件）。
- ブランチ `feat/viewer` を main へ `--no-ff` でマージ。push しない。

## 決定事項

- 対象は実係数の多項式のみ（次数 1〜8）。陰関数・有理関数は必要になったら別の仕様。
- 外部ライブラリなし、Canvas 2D の自前投影（平行投影）、`file://` で開ける。
- 色分けは真上から見たつながり。頂点（f(c) が実数の臨界点）では向かい合う枝をつなぐ（通り抜けの規則）。
  退化点では色の組み合わせが不連続に変わる（設計書 4.4 の表）。添付図3枚目右の塗り分けとは異なる（合意済み）。
- 重根とみなす距離は約 1e-6（Aberth の平均を Newton で磨き、p…p^(k−2) を 1e-12 で確かめる）。
- 表示範囲の自動設定：R は根と臨界点の 1.3 倍、Y は実曲線（|x| ≤ R）と頂点の y の 1.1 倍。虚曲線は箱で切れてよい。
- 開発用サーバは `D:\claude_code\.claude\launch.json` の `decaus-http`（ポート 8770）。

## 次にやれること（未着手）

- 陰関数 F(x, y) = 0・有理関数への拡張。
- 指数関数・三角関数（追記のらせん・双曲線）。
```

- [ ] **Step 4: ブラウザで確かめる**

`preview_start` で `decaus-http` を開き（`http://localhost:8770/`）、次を確かめる。

1. コンソールにエラーがない。
2. 初期表示（3次・極値2つ）で、黒の実曲線と赤・青の虚曲線が添付図2の左と同じ形。
3. プリセット「基本形3次」「基本形4次」で「真上」→ 原点を通る直線が 2n 本の放射状（添付図1の下段）、「真横」→ 添付図1の上段。
4. プリセット「4次・極値＋変曲点」で「真上」→ 原点を赤と青がそれぞれ直線のまま通り抜け、x = −1 を緑が縦に通る。状態欄に「退化点あり：…」。
5. 最高次の係数欄に 0 を入れる → 警告「最高次の係数が 0 です（直前の図を表示しています）」、図は残る。
6. 係数欄を空にする → 何も起きない（エラーなし）。
7. 幅 375px（`resize_window` の mobile）でパネルが上、図が下に並ぶ。確認後 desktop に戻す。
8. スライダーを動かして滑らかに再描画される。

- [ ] **Step 5: コミット**

```bash
cd /d/claude_code/decaus && git add index.html view.js README.md HANDOFF.md && git commit -m "feat: 画面・描画・操作と説明書き

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## 仕上げ

- [ ] superpowers:finishing-a-development-branch に従い、`feat/viewer` を main へ `git merge --no-ff feat/viewer` でマージする（push しない）。
- [ ] `D:\claude_code\.claude\launch.json` から試作用の `decaus-proto-http` の設定を削除する（`decaus-http` は残す）。
