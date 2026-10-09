(function () {
  'use strict';
  const language = document.body.dataset.track;
  if (!['en', 'de'].includes(language)) return;
  const prefix = 'learnLanguage.pragmatics.' + language + '.';
  let unavailable = false;
  function load(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(prefix + key) || 'null');
      if (value === null) return fallback;
      if (Array.isArray(fallback)) return Array.isArray(value) ? value : fallback;
      return typeof value === 'object' && !Array.isArray(value) ? value : fallback;
    } catch (_) { unavailable = true; return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(prefix + key, JSON.stringify(value)); return true; }
    catch (_) { unavailable = true; return false; }
  }
  function dateText(value) {
    return value.getFullYear() + '-' + String(value.getMonth() + 1).padStart(2, '0') + '-' + String(value.getDate()).padStart(2, '0');
  }
  function after(days) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + days); return dateText(d); }
  const today = after(0);
  const progress = load('progress', {});
  Object.keys(progress).forEach(id => {
    const p = progress[id];
    if (!/^\d{2}$/.test(id) || Number(id) < 1 || Number(id) > 48 || !p || !['mastered', 'practice'].includes(p.state) || !/^\d{4}-\d{2}-\d{2}$/.test(p.due || '')) delete progress[id];
  });
  const box = document.querySelector('[data-pragmatics-progress]');
  if (box) {
    const id = box.dataset.lesson, status = box.querySelector('[data-progress-status]');
    function update(message) {
      const p = progress[id];
      status.textContent = message || (p ? (p.state === 'mastered' ? '已记录：本章已掌握。' : '已记录：本章还需练习。') + ' 下次复习：' + p.due : '尚未记录本章。完成练习后可记录掌握情况。');
      if (unavailable) status.textContent += ' 浏览器无法长期保存；本次页面仍可使用。';
    }
    box.querySelector('[data-progress-done]').addEventListener('click', () => {
      const old = progress[id], already = old && old.state === 'mastered' && old.last === today;
      const level = already ? old.level : Math.min(4, ((old && old.state === 'mastered' && Number.isInteger(old.level)) ? old.level : 0) + 1);
      progress[id] = { state: 'mastered', level, last: today, due: already ? old.due : after([0, 3, 7, 14, 30][level]) };
      save('progress', progress); update();
    });
    box.querySelector('[data-progress-review]').addEventListener('click', () => {
      progress[id] = { state: 'practice', level: 0, last: today, due: after(1) };
      save('progress', progress); update();
    });
    box.querySelector('[data-progress-reset]').addEventListener('click', () => {
      delete progress[id]; save('progress', progress); update('已清除本章记录，其他章节保留。');
    });
    update();
  }
  const dashboard = document.querySelector('[data-study-dashboard]');
  if (dashboard) {
    const items = Array.from(dashboard.querySelectorAll('[data-study-item]'));
    const dueOnly = dashboard.querySelector('[data-study-due]');
    const buttons = Array.from(dashboard.querySelectorAll('[data-study-route]'));
    let route = 'all';
    function show() {
      let visible = 0, mastered = 0, due = 0;
      items.forEach(item => {
        const p = progress[item.dataset.lesson], isDue = p && p.due <= today;
        if (p && p.state === 'mastered') mastered++;
        if (isDue) due++;
        item.hidden = (route !== 'all' && !item.dataset.routes.split(' ').includes(route)) || (dueOnly.checked && !isDue);
        if (!item.hidden) visible++;
        item.querySelector('[data-study-state]').textContent = !p ? '' : (p.state === 'mastered' ? '已掌握' : '还需练习') + (isDue ? ' · 应复习' : ' · ' + p.due + ' 复习');
      });
      dashboard.querySelectorAll('[data-study-module]').forEach(module => {
        module.hidden = !Array.from(module.querySelectorAll('[data-study-item]')).some(item => !item.hidden);
      });
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.studyRoute === route)));
      dashboard.querySelector('[data-study-empty]').hidden = visible !== 0;
      dashboard.querySelector('[data-study-status]').textContent = '已掌握 ' + mastered + ' / 48 章；应复习 ' + due + ' 章；当前显示 ' + visible + ' 章。' + (unavailable ? ' 浏览器无法读取保存记录。' : '');
    }
    buttons.forEach(button => button.addEventListener('click', () => { route = button.dataset.studyRoute; show(); }));
    dueOnly.addEventListener('change', show); show();
  }

  // Store source context alongside a course favorite; keep the existing favorite IDs.
  const metadata = load('expressions', {});
  function syncCard(card) {
    const id = card.dataset.templateId;
    if (card.querySelector('[data-save]').getAttribute('aria-pressed') === 'true') {
      metadata[id] = { phrase: card.querySelector('[data-expression-phrase]').textContent, meaning: card.querySelector('[data-expression-meaning]').textContent,
        context: card.querySelector('[data-expression-context]').textContent, title: document.querySelector('h1').textContent, url: location.pathname };
    } else { delete metadata[id]; }
    save('expressions', metadata);
  }
  document.querySelectorAll('[data-pragmatics-expression]').forEach(card => {
    if (card.querySelector('[data-save]').getAttribute('aria-pressed') === 'true') syncCard(card);
    card.querySelector('[data-save]').addEventListener('click', () => syncCard(card));
  });

  const notebook = document.querySelector('[data-pragmatics-notebook]');
  if (!notebook) return;
  const form = notebook.querySelector('[data-note-form]'), status = notebook.querySelector('[data-note-status]');
  const list = notebook.querySelector('[data-note-list]'), undo = notebook.querySelector('[data-note-undo]');
  const labels = { phrase: '原句', context: '前后文与关系', reading: '意思与依据', question: '待确认', reply: '我的回应' };
  let notes = load('notes', []).filter(n => n && typeof n.id === 'string' && typeof n.phrase === 'string').map(n => {
    const clean = { id: n.id.slice(0, 120), created: String(n.created || '').slice(0, 50) };
    Object.keys(labels).forEach(key => { clean[key] = String(n[key] || '').slice(0, 4000); });
    return clean;
  });
  let editing = null, deleted = null;
  function message(text) { status.textContent = text + (unavailable ? ' 浏览器无法长期保存；本次页面记录可导出备份。' : ''); }
  function button(text, action) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.addEventListener('click', action); return b;
  }
  function renderNotes() {
    list.replaceChildren();
    if (!notes.length) { const p = document.createElement('p'); p.textContent = '尚未保存笔记。'; list.append(p); }
    notes.forEach(note => {
      const section = document.createElement('section'); section.className = 'note-item';
      const h = document.createElement('h3'); h.textContent = note.phrase; section.append(h);
      Object.entries(labels).forEach(([key, title]) => {
        if (key === 'phrase' || !note[key]) return;
        const p = document.createElement('p'), b = document.createElement('strong');
        b.textContent = title + '：'; p.append(b, document.createTextNode(note[key])); section.append(p);
      });
      const controls = document.createElement('div'); controls.className = 'study-controls';
      controls.append(button('编辑', () => {
        editing = note.id;
        Object.keys(labels).forEach(key => { form.elements.namedItem(key).value = note[key]; });
        message('正在编辑这条笔记。点“保存笔记”才会更新；开始新笔记会放弃尚未保存的编辑。');
        form.elements.namedItem('phrase').focus();
      }), button('删除', () => {
        deleted = note; notes = notes.filter(n => n.id !== note.id); save('notes', notes);
        if (editing === note.id) { editing = null; form.reset(); }
        undo.hidden = false; renderNotes(); message('已删除一条笔记，可以撤销刚才的删除。');
      }));
      section.append(controls); list.append(section);
    });
  }
  form.addEventListener('submit', event => event.preventDefault());
  notebook.querySelector('[data-note-save]').addEventListener('click', () => {
    if (!form.reportValidity()) return;
    const fields = Object.fromEntries(Object.keys(labels).map(key => [key, form.elements.namedItem(key).value.trim().slice(0, 4000)]));
    if (!fields.phrase) { message('请先填写原句。'); form.elements.namedItem('phrase').focus(); return; }
    const previous = notes.find(n => n.id === editing);
    const note = { ...fields, id: editing || (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)), created: previous ? previous.created : new Date().toISOString() };
    const index = notes.findIndex(n => n.id === editing);
    if (index >= 0) notes[index] = note; else notes.unshift(note);
    const persisted = save('notes', notes);
    editing = null; form.reset(); renderNotes(); message(persisted ? '笔记已保存。' : '本次页面内已保存笔记。');
  });
  notebook.querySelector('[data-note-new]').addEventListener('click', () => { editing = null; form.reset(); message('可以开始新笔记。未保存的编辑已清空。'); });
  undo.addEventListener('click', () => {
    if (!deleted) return; notes.unshift(deleted); deleted = null; save('notes', notes); undo.hidden = true; renderNotes(); message('已恢复刚才删除的笔记。');
  });
  notebook.querySelector('[data-note-export]').addEventListener('click', () => {
    if (!notes.length) { message('还没有已保存的笔记可导出。'); return; }
    const text = notes.map(note => Object.entries(labels).map(([key, label]) => label + '：' + note[key]).join('\n') + '\n保存日期：' + note.created).join('\n\n——\n\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = '表达笔记-' + language + '-' + today + '.txt';
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('已导出已保存笔记；尚未保存的编辑不包含在备份中。');
  });
  const saved = notebook.querySelector('[data-saved-phrases]'); saved.replaceChildren();
  let favoriteIds = [];
  try { const value = JSON.parse(localStorage.getItem('learnLanguage.communication.favorites.' + language) || '[]'); if (Array.isArray(value)) favoriteIds = value; }
  catch (_) { unavailable = true; }
  let savedCount = 0;
  favoriteIds.forEach(id => {
    const entry = metadata[id];
    if (!entry || typeof entry.phrase !== 'string' || typeof entry.url !== 'string' || !entry.url.startsWith('/learnLanguage/' + language + '/pragmatics/')) return;
    const section = document.createElement('section'); section.className = 'note-item';
    const a = document.createElement('a'); a.href = entry.url; a.textContent = entry.phrase;
    const p = document.createElement('p'); p.textContent = String(entry.meaning || '') + '\n' + String(entry.context || '');
    section.append(a, p); saved.append(section); savedCount++;
  });
  if (!savedCount) { const p = document.createElement('p'); p.textContent = '尚未收藏本课表达。可在章节中收藏，再回这里读语境。'; saved.append(p); }
  renderNotes(); if (unavailable) message('可以继续填写和阅读。');
})();
