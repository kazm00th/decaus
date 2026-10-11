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
  if (typeof module !== 'undefined' && module.exports) module.exports = Decaus;
  else window.Decaus = Decaus;
})();
