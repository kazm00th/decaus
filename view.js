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
