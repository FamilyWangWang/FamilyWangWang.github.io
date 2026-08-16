/* 数学版图 · 进度涂色 —— Atlas der Mathematik · Fortschritt
   点一下格子换一次状态：没学 → 学过 → 掌握 → 没学。
   进度存在浏览器自己的 localStorage 里，不上传任何地方，换浏览器或清缓存会丢，
   所以页面底部提供了「存档」文本框，可以复制出来自己留一份。 */
(function () {
'use strict';

var DE = ((document.documentElement.getAttribute('lang') || '').slice(0, 2) === 'de');
function T(zh, de) { return DE ? de : zh; }
var KEY = 'atlas.progress.v1';

var TIER = [
  { zh: '山脚 · 不需要前置知识', de: 'Talboden · kein Vorwissen nötig' },
  { zh: '山腰 · 需要代数与函数打底', de: 'Hangweg · Algebra und Funktionen nötig' },
  { zh: '山顶与远方 · 只做导览', de: 'Gipfel & Fernsicht · nur Aussicht' }
];
var STATE = [
  { zh: '还没学', de: 'noch nicht', tick: '' },
  { zh: '学过了', de: 'gelernt', tick: '◐' },
  { zh: '掌握了', de: 'sitzt', tick: '✓' }
];

var store = {};
try { store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* 隐私模式下写不进去，不影响本次使用 */ } }

function elm(tag, cls, parent, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

var chips = [], strandBoxes = [];

function build(host) {
  var data = window.ATLAS_DATA || [];
  data.forEach(function (s) {
    var box = elm('div', 'pg-strand', host);
    var h = elm('h3', null, box);
    var a = document.createElement('a');
    a.href = DE ? s.deHref : s.zhHref;
    a.textContent = DE ? s.de : s.zh;
    a.style.textDecoration = 'none'; a.style.color = 'inherit';
    h.appendChild(a);
    elm('em', null, h, DE ? s.deSub : s.zhSub);
    var pct = elm('span', 'pct', h, '');
    var mine = [];
    s.tiers.forEach(function (items, ti) {
      var t = elm('div', 'pg-tier', box);
      elm('span', 'lbl', t, TIER[ti][DE ? 'de' : 'zh']);
      var row = elm('div', 'chips', t);
      items.forEach(function (pair, ii) {
        var id = s.id + 't' + ti + 'i' + ii;
        var b = elm('button', 'chip', row);
        b.type = 'button';
        var tick = elm('span', 'tick', b, '');
        var lab = elm('span', null, b, DE ? pair[1] : pair[0]);
        var rec = { id: id, el: b, tick: tick, name: DE ? pair[1] : pair[0] };
        b.addEventListener('click', function () {
          store[id] = ((store[id] || 0) + 1) % 3;
          if (!store[id]) delete store[id];
          save(); paint(rec); refresh();
        });
        chips.push(rec); mine.push(rec);
        paint(rec);
      });
    });
    var bar = elm('div', 'bar', box.querySelector('h3'));
    strandBoxes.push({ chips: mine, pct: pct, bar: bar });
  });
}

function paint(rec) {
  var st = store[rec.id] || 0;
  rec.el.setAttribute('data-s', st);
  rec.tick.textContent = STATE[st].tick;
  rec.el.setAttribute('aria-label', rec.name + ' — ' + STATE[st][DE ? 'de' : 'zh'] +
    T('（点一下换状态）', ' (klicken zum Ändern)'));
  rec.el.title = STATE[st][DE ? 'de' : 'zh'];
}

function tally(list) {
  var seen = 0, got = 0;
  list.forEach(function (c) { var s = store[c.id] || 0; if (s >= 1) seen++; if (s === 2) got++; });
  return { seen: seen, got: got, all: list.length };
}
function setBar(bar, t) {
  bar.innerHTML = '';
  var i2 = elm('i', 'b2', bar); i2.style.width = (t.got / t.all * 100) + '%';
  var i1 = elm('i', 'b1', bar); i1.style.width = ((t.seen - t.got) / t.all * 100) + '%';
}

var topBig, topSub, topBar, dump;
function refresh() {
  strandBoxes.forEach(function (sb) {
    var t = tally(sb.chips);
    sb.pct.textContent = t.seen + '/' + t.all;
    setBar(sb.bar, t);
  });
  var t = tally(chips);
  topBig.textContent = t.seen + ' / ' + t.all;
  topSub.textContent = T(
    '碰过的知识点，其中 ' + t.got + ' 个已经掌握。整本册子一共 ' + t.all + ' 个格子。',
    'Themen angefasst, davon ' + t.got + ' sicher. Insgesamt hat der Atlas ' + t.all + ' Felder.'
  );
  setBar(topBar, t);
  if (dump) dump.value = JSON.stringify(store);
}

function boot() {
  var host = document.getElementById('grid');
  if (!host) return;
  var ns = document.querySelectorAll('.nojs'), i;
  for (i = 0; i < ns.length; i++) ns[i].parentNode.removeChild(ns[i]);

  var top = document.getElementById('summary');
  topBig = elm('div', 'big', top);
  topSub = elm('p', 'sub', top);
  topBar = elm('div', 'bar', top);
  var key = elm('div', 'pg-key', top);
  [['', T('还没学', 'noch nicht')], ['k1', T('学过了', 'gelernt')], ['k2', T('掌握了', 'sitzt')]]
    .forEach(function (k) {
      var sp = elm('span', null, key);
      elm('i', k[0], sp); elm('span', null, sp, k[1]);
    });

  build(host);

  var tools = document.getElementById('tools');
  if (tools) {
    var btns = elm('div', 'lab-btns', tools);
    btns.style.padding = '0';
    var bReset = elm('button', null, btns, T('全部清空', 'alles zurücksetzen'));
    bReset.type = 'button';
    bReset.addEventListener('click', function () {
      if (!window.confirm(T('确定要把所有进度清空吗？这一步撤不回来。',
        'Wirklich den gesamten Fortschritt löschen? Das lässt sich nicht rückgängig machen.'))) return;
      store = {}; save(); chips.forEach(paint); refresh();
    });
    var bLoad = elm('button', null, btns, T('读入下面框里的存档', 'Sicherung unten einlesen'));
    bLoad.type = 'button';
    bLoad.addEventListener('click', function () {
      try {
        var o = JSON.parse(dump.value);
        if (!o || typeof o !== 'object') throw 0;
        store = o; save(); chips.forEach(paint); refresh();
      } catch (e) {
        window.alert(T('这段存档读不出来，检查一下有没有复制全。',
          'Diese Sicherung lässt sich nicht lesen — bitte prüfen, ob sie vollständig kopiert wurde.'));
      }
    });
    dump = elm('textarea', 'pg-save', tools);
    dump.rows = 3;
    dump.setAttribute('aria-label', T('进度存档', 'Sicherung des Fortschritts'));
    dump.spellcheck = false;
  }
  refresh();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
