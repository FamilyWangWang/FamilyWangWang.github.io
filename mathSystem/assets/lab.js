/* 数学版图 · 互动实验室 —— Atlas der Mathematik · Labor
   纯原生 JS，零依赖，离线可用。
   页面里每个 <div class="lab" data-widget="xxx"> 会被下面对应的构造函数接管：
   舞台（SVG）、滑块、读数三块都由 JS 生成，HTML 里只留标题和「看什么」那段话。
   这样中文版和德语版共用同一份逻辑，只有文案分叉，改一次两边都对。 */
(function () {
'use strict';

var NS = 'http://www.w3.org/2000/svg';
var DE = ((document.documentElement.getAttribute('lang') || '').slice(0, 2) === 'de');
function T(zh, de) { return DE ? de : zh; }

var uid = 0;

function mk(name, attrs, parent) {
  var e = document.createElementNS(NS, name), k;
  for (k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function txt(node, s) { node.textContent = s; return node; }
function fmt(v, d) {
  if (!isFinite(v)) return '—';
  var s = v.toFixed(d);
  if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
  return s;
}
function sign(v, d) { return (v < 0 ? '− ' : '+ ') + fmt(Math.abs(v), d); }

/* ── 画框：把数学坐标换算成 SVG 坐标 ───────────────────── */
function Frame(svg, W, H, xr, yr, pad) {
  this.svg = svg; this.W = W; this.H = H; this.xr = xr; this.yr = yr;
  this.pad = pad || { l: 36, r: 16, t: 16, b: 28 };
  this.iw = W - this.pad.l - this.pad.r;
  this.ih = H - this.pad.t - this.pad.b;
}
Frame.prototype.X = function (x) { return this.pad.l + (x - this.xr[0]) / (this.xr[1] - this.xr[0]) * this.iw; };
Frame.prototype.Y = function (y) { return this.pad.t + this.ih - (y - this.yr[0]) / (this.yr[1] - this.yr[0]) * this.ih; };
Frame.prototype.clip = function () {
  var id = 'clip' + (++uid), defs = mk('defs', {}, this.svg), c = mk('clipPath', { id: id }, defs);
  mk('rect', { x: this.pad.l, y: this.pad.t, width: this.iw, height: this.ih }, c);
  return 'url(#' + id + ')';
};
Frame.prototype.axes = function (g, sx, sy, dx, dy) {
  var i, v, self = this;
  var xa = Math.ceil(this.xr[0] / sx - 1e-9), xb = Math.floor(this.xr[1] / sx + 1e-9);
  var ya = Math.ceil(this.yr[0] / sy - 1e-9), yb = Math.floor(this.yr[1] / sy + 1e-9);
  for (i = xa; i <= xb; i++) { v = i * sx; mk('line', { x1: this.X(v), y1: this.pad.t, x2: this.X(v), y2: this.H - this.pad.b, class: 'svg-l-soft' }, g); }
  for (i = ya; i <= yb; i++) { v = i * sy; mk('line', { x1: this.pad.l, y1: this.Y(v), x2: this.W - this.pad.r, y2: this.Y(v), class: 'svg-l-soft' }, g); }
  var hasY0 = this.yr[0] <= 0 && this.yr[1] >= 0, hasX0 = this.xr[0] <= 0 && this.xr[1] >= 0;
  if (hasY0) mk('line', { x1: this.pad.l, y1: this.Y(0), x2: this.W - this.pad.r, y2: this.Y(0), class: 'svg-l' }, g);
  if (hasX0) mk('line', { x1: this.X(0), y1: this.pad.t, x2: this.X(0), y2: this.H - this.pad.b, class: 'svg-l' }, g);
  var yBase = hasY0 ? this.Y(0) + 14 : this.H - this.pad.b + 14;
  var xBase = hasX0 ? this.X(0) - 6 : this.pad.l - 6;
  for (i = xa; i <= xb; i++) {
    v = i * sx; if (Math.abs(v) < 1e-9) continue;
    txt(mk('text', { x: this.X(v), y: yBase, 'text-anchor': 'middle', class: 'svg-tm' }, g), fmt(v, dx || 0));
  }
  for (i = ya; i <= yb; i++) {
    v = i * sy; if (Math.abs(v) < 1e-9) continue;
    txt(mk('text', { x: xBase, y: this.Y(v) + 4, 'text-anchor': 'end', class: 'svg-tm' }, g), fmt(v, dy || 0));
  }
  if (hasX0 && hasY0) txt(mk('text', { x: this.X(0) - 6, y: this.Y(0) + 14, 'text-anchor': 'end', class: 'svg-tm' }, g), '0');
  return self;
};
/* 采样成路径；跑出画框太远就断开，交给 clipPath 收边 */
Frame.prototype.d = function (f, n) {
  n = n || 320;
  var span = this.yr[1] - this.yr[0], lo = this.yr[0] - span, hi = this.yr[1] + span;
  var s = '', i, x, y, on = false;
  for (i = 0; i <= n; i++) {
    x = this.xr[0] + (this.xr[1] - this.xr[0]) * i / n; y = f(x);
    if (!isFinite(y) || y < lo || y > hi) { on = false; continue; }
    s += (on ? 'L' : 'M') + this.X(x).toFixed(2) + ' ' + this.Y(y).toFixed(2) + ' ';
    on = true;
  }
  return s;
};

/* ── 组件外壳：舞台 / 控件 / 读数 ─────────────────────── */
function shell(root, W, H, label) {
  var note = root.querySelector('.lab-note');
  var stage = document.createElement('div'); stage.className = 'lab-stage';
  var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': label }, stage);
  var ctrl = document.createElement('div'); ctrl.className = 'lab-ctrl';
  var read = document.createElement('div'); read.className = 'lab-read';
  root.insertBefore(stage, note); root.insertBefore(ctrl, note); root.insertBefore(read, note);
  return { svg: svg, ctrl: ctrl, read: read, note: note };
}
function slider(host, label, min, max, step, val) {
  var l = document.createElement('label');
  var cap = document.createElement('span'); cap.className = 'cap';
  var a = document.createElement('span'); a.textContent = label;
  var b = document.createElement('b');
  cap.appendChild(a); cap.appendChild(b);
  var i = document.createElement('input');
  i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = val;
  i.setAttribute('aria-label', label);
  l.appendChild(cap); l.appendChild(i); host.appendChild(l);
  return { input: i, out: b, get: function () { return parseFloat(i.value); } };
}
function picker(host, label, opts) {
  var l = document.createElement('label');
  var cap = document.createElement('span'); cap.className = 'cap';
  txt(cap.appendChild(document.createElement('span')), label);
  var s = document.createElement('select');
  s.setAttribute('aria-label', label);
  opts.forEach(function (o, k) { var op = document.createElement('option'); op.value = k; op.textContent = o; s.appendChild(op); });
  l.appendChild(cap); l.appendChild(s); host.appendChild(l);
  return { input: s, get: function () { return parseInt(s.value, 10); } };
}
function readout(host, key) {
  var d = document.createElement('div');
  var k = document.createElement('span'); k.className = 'k'; k.textContent = key;
  var v = document.createElement('span'); v.className = 'v';
  d.appendChild(k); d.appendChild(v); host.appendChild(d);
  return v;
}
function buttons(root, defs) {
  var box = document.createElement('div'); box.className = 'lab-btns';
  defs.forEach(function (d) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = d[0]; b.addEventListener('click', d[1]);
    box.appendChild(b);
  });
  root.insertBefore(box, root.querySelector('.lab-note'));
}
function live(inputs, fn) {
  inputs.forEach(function (c) { c.input.addEventListener('input', fn); });
  fn();
}

/* ══ 实验 1 · 斜率是什么 ═════════════════════════════════ */
function wLine(root) {
  var W = 640, H = 380, s = shell(root, W, H, T('一次函数 y = m x + b 的图像，可以拖动滑块改变斜率和截距',
    'Graph der linearen Funktion y = m x + b, Steigung und Achsenabschnitt per Regler verstellbar'));
  var F = new Frame(s.svg, W, H, [-5.5, 5.5], [-5.5, 5.5]);
  var cl = F.clip();
  var gg = mk('g', {}, s.svg); F.axes(gg, 1, 1);
  var g = mk('g', { 'clip-path': cl }, s.svg);
  var stair = mk('path', { class: 'svg-l', stroke: 'var(--el1)', 'stroke-dasharray': '4 3', fill: 'none' }, g);
  var run = txt(mk('text', { class: 'svg-ts', fill: 'var(--el1)', 'text-anchor': 'middle' }, g), '');
  var rise = txt(mk('text', { class: 'svg-ts', fill: 'var(--el1)' }, g), '');
  var line = mk('path', { fill: 'none', stroke: 'var(--mark)', 'stroke-width': 2.4 }, g);
  var dotB = mk('circle', { r: 5, fill: 'var(--mark)' }, g);

  /* 台阶上那两个标签会跟 x 轴的刻度数字打架：中文「右 1」短，怎么摆都躲得开，
     德语「1 rechts」「runter 2.50」宽两三倍，就压上去了。
     字体度量不能靠猜——同样 11px，"2" 的包围盒高 12.6，"runter 0.50" 高 14.7。
     所以这里把刻度的真实包围盒量出来，谁真撞上了才把谁挪开。 */
  var ticks = [];
  function bbox(el) { try { var b = el.getBBox(); return b.width ? b : null; } catch (e) { return null; } }
  function measureTicks() {
    ticks = [];
    Array.prototype.forEach.call(gg.querySelectorAll('text'), function (t) {
      if (t.getAttribute('text-anchor') !== 'middle') return;   /* 只取 x 轴那一行 */
      var b = bbox(t); if (b) ticks.push(b);
    });
  }
  function hit(b) {
    for (var i = 0; i < ticks.length; i++) {
      var t = ticks[i];
      if (b.x < t.x + t.width && b.x + b.width > t.x && b.y < t.y + t.height && b.y + b.height > t.y) return t;
    }
    return null;
  }
  function place(el, y, above) {
    el.setAttribute('y', y);
    var b = bbox(el); if (!b) return;
    var t = hit(b); if (!t) return;
    el.setAttribute('y', y + (above ? (t.y - 3) - (b.y + b.height) : (t.y + t.height + 3) - b.y));
  }
  measureTicks();

  var m = slider(s.ctrl, T('斜率 m', 'Steigung m'), -3, 3, 0.25, 0.5);
  var b = slider(s.ctrl, T('截距 b', 'Achsenabschnitt b'), -4, 4, 0.5, 1);
  var rEq = readout(s.read, T('方程', 'Gleichung'));
  var rSt = readout(s.read, T('右走 1 格，上下走', 'Ein Schritt nach rechts'));
  var rZ = readout(s.read, T('零点（和 x 轴的交点）', 'Nullstelle'));

  live([m, b], function () {
    var M = m.get(), B = b.get();
    m.out.textContent = fmt(M, 2); b.out.textContent = fmt(B, 1);
    line.setAttribute('d', F.d(function (x) { return M * x + B; }, 2));
    dotB.setAttribute('cx', F.X(0)); dotB.setAttribute('cy', F.Y(B));
    stair.setAttribute('d', 'M' + F.X(0) + ' ' + F.Y(B) + ' L' + F.X(1) + ' ' + F.Y(B) + ' L' + F.X(1) + ' ' + F.Y(B + M));
    /* 先写文字再定位置：place() 要量真实包围盒，文字得先在里面 */
    var midY = F.Y(B + M / 2), axisY = F.Y(0);
    run.setAttribute('x', F.X(0.5));
    txt(run, T('右 1', '1 rechts'));
    place(run, F.Y(B) - 7, true);
    rise.setAttribute('x', F.X(1) + 7);
    txt(rise, Math.abs(M) < 1e-9 ? '' : (M > 0 ? T('上 ', 'hoch ') : T('下 ', 'runter ')) + fmt(Math.abs(M), 2));
    place(rise, midY + 4, midY <= axisY);
    rEq.textContent = 'y = ' + fmt(M, 2) + ' x ' + sign(B, 1);
    rSt.textContent = (M >= 0 ? T('上 ', 'hoch ') : T('下 ', 'runter ')) + fmt(Math.abs(M), 2) + T(' 格', '');
    rZ.textContent = Math.abs(M) < 1e-9 ? T('没有（水平线）', 'keine (waagerecht)') : 'x = ' + fmt(-B / M, 2);
  });
}

/* ══ 实验 2 · 抛物线的三个把手 ═══════════════════════════ */
function wParabola(root) {
  var W = 640, H = 420, s = shell(root, W, H, T('抛物线 y = a(x−d)² + e 的图像，三个滑块分别控制开口、左右平移和上下平移',
    'Parabel y = a(x−d)² + e; drei Regler steuern Öffnung, Verschiebung nach rechts und nach oben'));
  var F = new Frame(s.svg, W, H, [-6.5, 6.5], [-5.5, 8.5]);
  var cl = F.clip();
  var gg = mk('g', {}, s.svg); F.axes(gg, 1, 2);
  var g = mk('g', { 'clip-path': cl }, s.svg);
  var axis = mk('line', { class: 'svg-l-soft', stroke: 'var(--el3)', 'stroke-dasharray': '5 4', 'stroke-width': 1.4 }, g);
  var curve = mk('path', { fill: 'none', stroke: 'var(--mark)', 'stroke-width': 2.4 }, g);
  var vtx = mk('circle', { r: 5.5, fill: 'var(--mark)' }, g);
  var r1 = mk('circle', { r: 4.5, fill: 'var(--el2)' }, g);
  var r2 = mk('circle', { r: 4.5, fill: 'var(--el2)' }, g);

  var a = slider(s.ctrl, T('a · 开口', 'a · Öffnung'), -2, 2, 0.1, 0.5);
  var d = slider(s.ctrl, T('d · 左右', 'd · nach rechts'), -4, 4, 0.25, 1);
  var e = slider(s.ctrl, T('e · 上下', 'e · nach oben'), -4, 5, 0.25, -2);
  var rV = readout(s.read, T('顶点式', 'Scheitelform'));
  var rG = readout(s.read, T('展开式', 'Normalform'));
  var rD = readout(s.read, T('判别式 D', 'Diskriminante D'));
  var rN = readout(s.read, T('零点', 'Nullstellen'));

  live([a, d, e], function () {
    var A = a.get(), D = d.get(), E = e.get();
    a.out.textContent = fmt(A, 1); d.out.textContent = fmt(D, 2); e.out.textContent = fmt(E, 2);
    curve.setAttribute('d', F.d(function (x) { return A * (x - D) * (x - D) + E; }));
    vtx.setAttribute('cx', F.X(D)); vtx.setAttribute('cy', F.Y(E));
    axis.setAttribute('x1', F.X(D)); axis.setAttribute('x2', F.X(D));
    axis.setAttribute('y1', F.pad.t); axis.setAttribute('y2', H - F.pad.b);
    rV.textContent = 'y = ' + fmt(A, 1) + '(x ' + sign(-D, 2) + ')² ' + sign(E, 2);
    var bb = -2 * A * D, cc = A * D * D + E;
    rG.textContent = 'y = ' + fmt(A, 1) + 'x² ' + sign(bb, 2) + 'x ' + sign(cc, 2);
    var disc = bb * bb - 4 * A * cc;                    /* 化简后正好是 −4ae */
    rD.textContent = fmt(disc, 2);
    if (Math.abs(A) < 1e-9) {
      rD.textContent = '—'; rN.textContent = T('a = 0，已经不是抛物线了', 'a = 0 — keine Parabel mehr');
      r1.setAttribute('r', 0); r2.setAttribute('r', 0);
      rD.className = 'v'; return;
    }
    var q = -E / A;
    if (q > 1e-12) {
      var w = Math.sqrt(q);
      rN.textContent = 'x = ' + fmt(D - w, 2) + '  ' + T('和', 'und') + '  ' + fmt(D + w, 2);
      r1.setAttribute('r', 4.5); r2.setAttribute('r', 4.5);
      r1.setAttribute('cx', F.X(D - w)); r1.setAttribute('cy', F.Y(0));
      r2.setAttribute('cx', F.X(D + w)); r2.setAttribute('cy', F.Y(0));
      rD.className = 'v';
    } else if (Math.abs(q) <= 1e-12) {
      rN.textContent = T('只有一个：x = ', 'genau eine: x = ') + fmt(D, 2);
      r1.setAttribute('r', 4.5); r2.setAttribute('r', 0);
      r1.setAttribute('cx', F.X(D)); r1.setAttribute('cy', F.Y(0));
      rD.className = 'v hi';
    } else {
      rN.textContent = T('一个也没有', 'keine');
      r1.setAttribute('r', 0); r2.setAttribute('r', 0);
      rD.className = 'v hi';
    }
  });
}

/* ══ 实验 3 · 单位圆怎么变成正弦波 ═══════════════════════ */
function wCircle(root) {
  var W = 660, H = 340, s = shell(root, W, H, T('左边单位圆上的点转动，右边同步画出正弦曲线',
    'Links wandert ein Punkt auf dem Einheitskreis, rechts entsteht dabei die Sinuskurve'));
  var cx = 120, cy = 170, R = 105;
  var x0 = 285, x1 = 640, ampl = 105;

  var g = mk('g', {}, s.svg);
  mk('circle', { cx: cx, cy: cy, r: R, class: 'svg-face', 'stroke-width': 1.4, fill: 'none', stroke: 'var(--rule)' }, g);
  mk('line', { x1: cx - R - 14, y1: cy, x2: cx + R + 14, y2: cy, class: 'svg-l' }, g);
  mk('line', { x1: cx, y1: cy - R - 14, x2: cx, y2: cy + R + 14, class: 'svg-l' }, g);
  mk('line', { x1: x0, y1: cy, x2: x1, y2: cy, class: 'svg-l' }, g);
  mk('line', { x1: x0, y1: cy - ampl - 12, x2: x0, y2: cy + ampl + 12, class: 'svg-l' }, g);
  [1, -1].forEach(function (k) {
    mk('line', { x1: x0 - 4, y1: cy - k * ampl, x2: x1, y2: cy - k * ampl, class: 'svg-l-soft', 'stroke-dasharray': '4 4' }, g);
    txt(mk('text', { x: x0 - 8, y: cy - k * ampl + 4, 'text-anchor': 'end', class: 'svg-tm' }, g), k > 0 ? '1' : '−1');
  });
  [[0.5, 'π/2'], [1, 'π'], [1.5, '3π/2'], [2, '2π']].forEach(function (p) {
    var X = x0 + (x1 - x0) * p[0] / 2;
    mk('line', { x1: X, y1: cy - 4, x2: X, y2: cy + 4, class: 'svg-l' }, g);
    txt(mk('text', { x: X, y: cy + 19, 'text-anchor': 'middle', class: 'svg-tm' }, g), p[1]);
  });

  var wave = mk('path', { fill: 'none', stroke: 'var(--mark)', 'stroke-width': 2.4 }, g);
  var cosL = mk('line', { stroke: 'var(--el2)', 'stroke-width': 3 }, g);
  var sinL = mk('line', { stroke: 'var(--el1)', 'stroke-width': 3 }, g);
  var arc = mk('path', { fill: 'none', stroke: 'var(--el3)', 'stroke-width': 2 }, g);
  var ray = mk('line', { stroke: 'var(--ink-2)', 'stroke-width': 1.6 }, g);
  var link = mk('line', { stroke: 'var(--mark)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }, g);
  var pt = mk('circle', { r: 5.5, fill: 'var(--mark)' }, g);
  var pt2 = mk('circle', { r: 5, fill: 'var(--mark)' }, g);
  txt(mk('text', { x: cx, y: cy + R + 34, 'text-anchor': 'middle', class: 'svg-ts', fill: 'var(--el2)' }, g), T('蓝＝cos', 'blau = cos'));
  txt(mk('text', { x: cx, y: cy - R - 24, 'text-anchor': 'middle', class: 'svg-ts', fill: 'var(--el1)' }, g), T('绿＝sin', 'grün = sin'));

  var th = slider(s.ctrl, T('角 θ', 'Winkel θ'), 0, 360, 1, 55);
  var rD = readout(s.read, T('角度', 'Gradmaß'));
  var rR = readout(s.read, T('弧度', 'Bogenmaß'));
  var rC = readout(s.read, 'cos θ');
  var rS = readout(s.read, 'sin θ');
  var rT = readout(s.read, 'tan θ');

  live([th], function () {
    var deg = th.get(), t = deg * Math.PI / 180, S = Math.sin(t), C = Math.cos(t);
    th.out.textContent = deg + '°';
    var px = cx + R * C, py = cy - R * S;
    pt.setAttribute('cx', px); pt.setAttribute('cy', py);
    ray.setAttribute('x1', cx); ray.setAttribute('y1', cy); ray.setAttribute('x2', px); ray.setAttribute('y2', py);
    cosL.setAttribute('x1', cx); cosL.setAttribute('y1', cy); cosL.setAttribute('x2', px); cosL.setAttribute('y2', cy);
    sinL.setAttribute('x1', px); sinL.setAttribute('y1', cy); sinL.setAttribute('x2', px); sinL.setAttribute('y2', py);
    var ar = 34, la = deg > 180 ? 1 : 0;
    arc.setAttribute('d', 'M' + (cx + ar) + ' ' + cy + ' A' + ar + ' ' + ar + ' 0 ' + la + ' 0 ' +
      (cx + ar * C) + ' ' + (cy - ar * S));
    var d = '', i, n = 240, tt, X;
    for (i = 0; i <= n; i++) {
      tt = t * i / n; X = x0 + (x1 - x0) * tt / (2 * Math.PI);
      d += (i ? 'L' : 'M') + X.toFixed(2) + ' ' + (cy - ampl * Math.sin(tt)).toFixed(2) + ' ';
    }
    wave.setAttribute('d', d);
    var wx = x0 + (x1 - x0) * t / (2 * Math.PI), wy = cy - ampl * S;
    pt2.setAttribute('cx', wx); pt2.setAttribute('cy', wy);
    link.setAttribute('x1', px); link.setAttribute('y1', py); link.setAttribute('x2', wx); link.setAttribute('y2', wy);
    rD.textContent = deg + '°';
    rR.textContent = fmt(t, 3);
    rC.textContent = fmt(C, 3); rS.textContent = fmt(S, 3);
    rT.textContent = Math.abs(C) < 1e-9 ? T('没有定义', 'nicht definiert') : fmt(S / C, 3);
    rT.className = Math.abs(C) < 1e-9 ? 'v hi' : 'v';
  });
}

/* ══ 实验 4 · 割线怎么滑成切线 ═══════════════════════════ */
function wTangent(root) {
  var W = 640, H = 420, s = shell(root, W, H, T('割线随着 h 变小逐渐转成切线，同时显示差商的数值',
    'Die Sekante dreht sich mit kleiner werdendem h in die Tangente; der Differenzenquotient wird mitgerechnet'));
  var FS = [
    { n: 'f(x) = x²/4', f: function (x) { return x * x / 4; }, df: function (x) { return x / 2; } },
    { n: 'f(x) = x³/8', f: function (x) { return x * x * x / 8; }, df: function (x) { return 3 * x * x / 8; } },
    { n: 'f(x) = sin x', f: Math.sin, df: Math.cos }
  ];
  var HS = [2, 1, 0.5, 0.25, 0.1, 0.05, 0.02, 0.01, 0.005, 0.001];
  var F = new Frame(s.svg, W, H, [-5.2, 5.2], [-3.2, 6.2]);
  var cl = F.clip();
  var gg = mk('g', {}, s.svg); F.axes(gg, 1, 1);
  var g = mk('g', { 'clip-path': cl }, s.svg);
  var curve = mk('path', { fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 2 }, g);
  var tang = mk('path', { fill: 'none', stroke: 'var(--el1)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }, g);
  var sec = mk('path', { fill: 'none', stroke: 'var(--mark)', 'stroke-width': 2.4 }, g);
  var dh = mk('path', { fill: 'none', stroke: 'var(--el2)', 'stroke-width': 1.4, 'stroke-dasharray': '3 3' }, g);
  var p0 = mk('circle', { r: 5.5, fill: 'var(--mark)' }, g);
  var p1 = mk('circle', { r: 5, fill: 'var(--el2)' }, g);

  var fs = picker(s.ctrl, T('函数', 'Funktion'), FS.map(function (o) { return o.n; }));
  var x0 = slider(s.ctrl, T('切点位置 x₀', 'Stelle x₀'), -3, 3, 0.25, 2);
  var hi = slider(s.ctrl, T('间距 h（往右拖到底）', 'Abstand h (nach rechts ziehen)'), 0, HS.length - 1, 1, 1);
  var rQ = readout(s.read, T('差商 (f(x₀+h) − f(x₀)) / h', 'Differenzenquotient'));
  var rT2 = readout(s.read, T('真正的导数 f′(x₀)', 'echte Ableitung f′(x₀)'));
  var rE = readout(s.read, T('还差多少', 'Abstand dazwischen'));

  live([fs, x0, hi], function () {
    var o = FS[fs.get()], X = x0.get(), h = HS[hi.get()];
    x0.out.textContent = fmt(X, 2); hi.out.textContent = 'h = ' + fmt(h, 3);
    var y0 = o.f(X), y1 = o.f(X + h), k = (y1 - y0) / h, kt = o.df(X);
    curve.setAttribute('d', F.d(o.f));
    sec.setAttribute('d', F.d(function (x) { return y0 + k * (x - X); }, 2));
    tang.setAttribute('d', F.d(function (x) { return y0 + kt * (x - X); }, 2));
    dh.setAttribute('d', 'M' + F.X(X) + ' ' + F.Y(y0) + ' L' + F.X(X + h) + ' ' + F.Y(y0) + ' L' + F.X(X + h) + ' ' + F.Y(y1));
    p0.setAttribute('cx', F.X(X)); p0.setAttribute('cy', F.Y(y0));
    p1.setAttribute('cx', F.X(X + h)); p1.setAttribute('cy', F.Y(y1));
    rQ.textContent = fmt(k, 5); rQ.className = 'v hi';
    rT2.textContent = fmt(kt, 5);
    rE.textContent = fmt(Math.abs(k - kt), 5);
  });
}

/* ══ 实验 5 · 长方形怎么填满曲线下的面积 ═════════════════ */
function wRiemann(root) {
  var W = 640, H = 400, s = shell(root, W, H, T('用 n 个长方形逼近曲线下的面积，n 越大越接近真实积分值',
    'Die Fläche unter der Kurve wird durch n Rechtecke angenähert; je größer n, desto genauer'));
  var FS = [
    { n: 'f(x) = x²', f: function (x) { return x * x; }, a: 0, b: 2, ex: 8 / 3, yr: [-0.5, 4.6], sy: 1 },
    { n: 'f(x) = √x', f: Math.sqrt, a: 0, b: 4, ex: 16 / 3, yr: [-0.35, 2.5], sy: 1 },
    { n: 'f(x) = sin x', f: Math.sin, a: 0, b: Math.PI, ex: 2, yr: [-0.25, 1.35], sy: 0.5 }
  ];
  var MODE = [T('左端点取高', 'Höhe am linken Rand'), T('右端点取高', 'Höhe am rechten Rand'), T('中点取高', 'Höhe in der Mitte')];
  var g0 = mk('g', {}, s.svg), gr = mk('g', {}, s.svg), gc = mk('g', {}, s.svg);
  var curve = mk('path', { fill: 'none', stroke: 'var(--mark)', 'stroke-width': 2.4 }, gc);

  var fs = picker(s.ctrl, T('函数', 'Funktion'), FS.map(function (o) { return o.n; }));
  var ms = picker(s.ctrl, T('长方形的高怎么取', 'Wo wird die Höhe gemessen'), MODE);
  var ns = slider(s.ctrl, T('长方形个数 n', 'Anzahl Rechtecke n'), 1, 80, 1, 6);
  var rS = readout(s.read, T('长方形总面积', 'Summe der Rechtecke'));
  var rX = readout(s.read, T('真实面积（积分）', 'wahre Fläche (Integral)'));
  var rE = readout(s.read, T('误差', 'Fehler'));
  var rW = readout(s.read, T('每个宽 Δx', 'Breite Δx'));

  live([fs, ms, ns], function () {
    var o = FS[fs.get()], mo = ms.get(), n = ns.get() | 0;
    ns.out.textContent = n;
    var pad = (o.b - o.a) * 0.14;
    var F = new Frame(s.svg, W, H, [o.a - pad, o.b + pad], o.yr);
    while (g0.firstChild) g0.removeChild(g0.firstChild);
    while (gr.firstChild) gr.removeChild(gr.firstChild);
    F.axes(g0, o.b <= 2.2 ? 0.5 : 1, o.sy, o.b <= 2.2 ? 1 : 0, o.sy < 1 ? 1 : 0);
    var dx = (o.b - o.a) / n, sum = 0, i, xL, xh, y, yTop, yBot;
    for (i = 0; i < n; i++) {
      xL = o.a + i * dx;
      xh = mo === 0 ? xL : (mo === 1 ? xL + dx : xL + dx / 2);
      y = o.f(xh); sum += y * dx;
      yTop = F.Y(Math.max(y, 0)); yBot = F.Y(Math.min(y, 0));
      mk('rect', {
        x: F.X(xL), y: yTop, width: Math.max(F.X(xL + dx) - F.X(xL) - 0.6, 0.6),
        height: Math.max(yBot - yTop, 0.6), fill: 'var(--el2-bg)', stroke: 'var(--el2)',
        'stroke-width': n > 45 ? 0.4 : 0.9
      }, gr);
    }
    curve.setAttribute('d', F.d(o.f));
    s.svg.appendChild(gc);
    rS.textContent = fmt(sum, 5); rS.className = 'v hi';
    rX.textContent = fmt(o.ex, 5);
    rE.textContent = fmt(Math.abs(sum - o.ex), 5);
    rW.textContent = fmt(dx, 4);
  });
}

/* ══ 实验 6 · 二项分布怎么长成正态曲线 ═══════════════════ */
function wBinomial(root) {
  var W = 660, H = 380, s = shell(root, W, H, T('二项分布的柱状图，n 变大时轮廓逐渐贴上正态曲线',
    'Stabdiagramm der Binomialverteilung; mit wachsendem n nähert sich die Form der Normalverteilung'));
  var g0 = mk('g', {}, s.svg), gb = mk('g', {}, s.svg), gn = mk('g', {}, s.svg);
  var pad = { l: 44, r: 16, t: 18, b: 34 };

  var ns = slider(s.ctrl, T('试验次数 n', 'Anzahl Versuche n'), 1, 50, 1, 10);
  var ps = slider(s.ctrl, T('单次成功率 p', 'Trefferwahrscheinlichkeit p'), 0, 1, 0.01, 0.5);
  var rM = readout(s.read, T('期望 μ = n p', 'Erwartungswert μ = n p'));
  var rS = readout(s.read, T('标准差 σ', 'Standardabweichung σ'));
  var rP = readout(s.read, T('最高那根柱子', 'höchster Stab'));
  var rI = readout(s.read, T('μ ± σ 覆盖了', 'μ ± σ deckt ab'));

  function pmf(n, p, k) {
    var r = 1, i;
    for (i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return r * Math.pow(p, k) * Math.pow(1 - p, n - k);
  }

  live([ns, ps], function () {
    var n = ns.get() | 0, p = ps.get();
    ns.out.textContent = n; ps.out.textContent = fmt(p, 2);
    while (gb.firstChild) gb.removeChild(gb.firstChild);
    while (g0.firstChild) g0.removeChild(g0.firstChild);
    while (gn.firstChild) gn.removeChild(gn.firstChild);
    var pr = [], max = 0, k, best = 0;
    for (k = 0; k <= n; k++) { pr[k] = pmf(n, p, k); if (pr[k] > max) { max = pr[k]; best = k; } }
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    var bw = iw / (n + 1), top = max * 1.12;
    var Y = function (v) { return pad.t + ih - v / top * ih; };
    mk('line', { x1: pad.l, y1: Y(0), x2: W - pad.r, y2: Y(0), class: 'svg-l' }, g0);
    mk('line', { x1: pad.l, y1: pad.t, x2: pad.l, y2: Y(0), class: 'svg-l' }, g0);
    var gs = top / 4, gi;
    for (gi = 1; gi <= 4; gi++) {
      mk('line', { x1: pad.l, y1: Y(gs * gi), x2: W - pad.r, y2: Y(gs * gi), class: 'svg-l-soft' }, g0);
      txt(mk('text', { x: pad.l - 7, y: Y(gs * gi) + 4, 'text-anchor': 'end', class: 'svg-tm' }, g0), fmt(gs * gi, 2));
    }
    var step = n <= 12 ? 1 : (n <= 26 ? 2 : 5);
    for (k = 0; k <= n; k++) {
      var x = pad.l + k * bw;
      mk('rect', {
        x: x + bw * 0.13, y: Y(pr[k]), width: bw * 0.74, height: Math.max(Y(0) - Y(pr[k]), 0.5),
        fill: k === best ? 'var(--mark-bg)' : 'var(--el2-bg)',
        stroke: k === best ? 'var(--mark)' : 'var(--el2)', 'stroke-width': n > 34 ? 0.5 : 1
      }, gb);
      if (k % step === 0) txt(mk('text', { x: x + bw / 2, y: Y(0) + 16, 'text-anchor': 'middle', class: 'svg-tm' }, g0), k);
    }
    var mu = n * p, sg = Math.sqrt(n * p * (1 - p));
    if (sg > 1e-6) {
      var d = '', j, xv, dens;
      for (j = 0; j <= 200; j++) {
        xv = -0.5 + (n + 1) * j / 200;
        dens = Math.exp(-(xv - mu) * (xv - mu) / (2 * sg * sg)) / (sg * Math.sqrt(2 * Math.PI));
        d += (j ? 'L' : 'M') + (pad.l + (xv + 0.5) * bw).toFixed(2) + ' ' + Y(dens).toFixed(2) + ' ';
      }
      mk('path', { d: d, fill: 'none', stroke: 'var(--el1)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }, gn);
      txt(mk('text', { x: W - pad.r, y: pad.t + 12, 'text-anchor': 'end', class: 'svg-ts', fill: 'var(--el1)' }, gn),
        T('绿虚线＝正态曲线', 'grün gestrichelt = Normalverteilung'));
    }
    var lo = Math.ceil(mu - sg), hiK = Math.floor(mu + sg), acc = 0;
    for (k = Math.max(0, lo); k <= Math.min(n, hiK); k++) acc += pr[k];
    rM.textContent = fmt(mu, 2);
    rS.textContent = fmt(sg, 3);
    rP.textContent = 'k = ' + best + '  (' + fmt(max * 100, 1) + '%)';
    rI.textContent = fmt(acc * 100, 1) + '%'; rI.className = 'v hi';
  });
}

/* ══ 实验 7 · 用随机点数出 π ═════════════════════════════ */
function wMonte(root) {
  var W = 640, H = 360, s = shell(root, W, H, T('往正方形里随机撒点，数落在圆内的比例，据此估计 π',
    'Zufällige Punkte im Quadrat; aus dem Anteil im Kreis wird π geschätzt'));
  var S = 300, ox = 26, oy = 28;
  var g = mk('g', {}, s.svg);
  mk('rect', { x: ox, y: oy, width: S, height: S, fill: 'none', stroke: 'var(--rule)', 'stroke-width': 1.4 }, g);
  mk('circle', { cx: ox + S / 2, cy: oy + S / 2, r: S / 2, fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 1.6 }, g);
  var pIn = mk('path', { fill: 'none', stroke: 'var(--el1)', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
  var pOut = mk('path', { fill: 'none', stroke: 'var(--mark)', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);

  var tx = 360, ty = 60, tw = W - tx - 20, th = 210;
  mk('line', { x1: tx, y1: ty + th, x2: tx + tw, y2: ty + th, class: 'svg-l' }, g);
  mk('line', { x1: tx, y1: ty, x2: tx, y2: ty + th, class: 'svg-l' }, g);
  var PI_Y = ty + th - (Math.PI - 2.6) / 1.0 * th;
  mk('line', { x1: tx, y1: PI_Y, x2: tx + tw, y2: PI_Y, class: 'svg-l-soft', stroke: 'var(--el1)', 'stroke-dasharray': '4 4' }, g);
  txt(mk('text', { x: tx + tw, y: PI_Y - 7, 'text-anchor': 'end', class: 'svg-ts', fill: 'var(--el1)' }, g), 'π = 3.14159…');
  txt(mk('text', { x: tx, y: ty - 10, class: 'svg-ts' }, g), T('估计值怎么爬向 π', 'Wie die Schätzung zu π wandert'));
  txt(mk('text', { x: tx - 6, y: ty + th + 4, 'text-anchor': 'end', class: 'svg-tm' }, g), '2.6');
  txt(mk('text', { x: tx - 6, y: ty + 4, 'text-anchor': 'end', class: 'svg-tm' }, g), '3.6');
  var trace = mk('path', { fill: 'none', stroke: 'var(--mark)', 'stroke-width': 1.8 }, g);

  var rN = readout(s.read, T('撒了多少点', 'Punkte insgesamt'));
  var rH = readout(s.read, T('落在圆内', 'davon im Kreis'));
  var rP = readout(s.read, T('π 的估计值 = 4 × 比例', 'Schätzung für π = 4 × Anteil'));
  var rE = readout(s.read, T('和真值差', 'Abweichung'));

  var tot = 0, ins = 0, dIn = '', dOut = '', hist = [];
  function draw() {
    pIn.setAttribute('d', dIn); pOut.setAttribute('d', dOut);
    var d = '', i;
    for (i = 0; i < hist.length; i++) {
      var v = Math.max(2.6, Math.min(3.6, hist[i]));
      d += (i ? 'L' : 'M') + (tx + tw * i / Math.max(hist.length - 1, 1)).toFixed(1) + ' ' +
        (ty + th - (v - 2.6) / 1.0 * th).toFixed(1) + ' ';
    }
    trace.setAttribute('d', d);
    var est = tot ? 4 * ins / tot : 0;
    rN.textContent = tot;
    rH.textContent = ins + (tot ? '  (' + fmt(100 * ins / tot, 1) + '%)' : '');
    rP.textContent = tot ? fmt(est, 5) : '—'; rP.className = 'v hi';
    rE.textContent = tot ? fmt(Math.abs(est - Math.PI), 5) : '—';
  }
  function add(n) {
    var i, x, y;
    for (i = 0; i < n; i++) {
      x = Math.random() * 2 - 1; y = Math.random() * 2 - 1;
      var sx = (ox + (x + 1) / 2 * S).toFixed(1), sy = (oy + (1 - y) / 2 * S).toFixed(1);
      if (x * x + y * y <= 1) { ins++; dIn += 'M' + sx + ' ' + sy + 'h0.01'; }
      else dOut += 'M' + sx + ' ' + sy + 'h0.01';
      tot++;
      if (tot % 20 === 0 || n < 20) { hist.push(4 * ins / tot); if (hist.length > 300) hist.shift(); }
    }
    draw();
  }
  buttons(root, [
    [T('撒 10 个点', '10 Punkte'), function () { add(10); }],
    [T('撒 100 个', '100 Punkte'), function () { add(100); }],
    [T('撒 1000 个', '1000 Punkte'), function () { add(1000); }],
    [T('清空重来', 'zurücksetzen'), function () { tot = ins = 0; dIn = dOut = ''; hist = []; draw(); }]
  ]);
  add(60);
}

/* ── 挂载 ───────────────────────────────────────────── */
var REG = {
  line: wLine, parabola: wParabola, circle: wCircle, tangent: wTangent,
  riemann: wRiemann, binomial: wBinomial, monte: wMonte
};
function boot() {
  var ns = document.querySelectorAll('.nojs'), i;
  for (i = 0; i < ns.length; i++) ns[i].parentNode.removeChild(ns[i]);
  var labs = document.querySelectorAll('.lab[data-widget]');
  for (i = 0; i < labs.length; i++) {
    var f = REG[labs[i].getAttribute('data-widget')];
    if (f) try { f(labs[i]); } catch (err) { if (window.console) console.error(labs[i].getAttribute('data-widget'), err); }
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
