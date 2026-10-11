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
