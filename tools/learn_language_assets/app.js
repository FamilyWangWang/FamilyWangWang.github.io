(function () {
  const body = document.body;
  const menuButton = document.querySelector('[data-menu-button]');
  const sidebar = document.querySelector('[data-sidebar]');

  if (menuButton && sidebar) {
    menuButton.addEventListener('click', function () {
      const open = sidebar.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.textContent = open ? '关闭' : '目录';
    });
  }

  let searchData = null;
  let searchPromise = null;
  const search = document.querySelector('[data-search]');
  const input = document.querySelector('[data-search-input]');
  const results = document.querySelector('[data-search-results]');
  const indexUrl = body.dataset.searchIndex;

  function normalizeAlias(value) {
    return value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
  }

  function aliasScore(row, normalizedQuery) {
    if (!row.normalizedAliases || !normalizedQuery) return 0;
    if (row.normalizedAliases.includes(normalizedQuery)) return 500;
    return normalizedQuery.length >= 4 && row.normalizedAliases.some(function (alias) {
      return alias.includes(normalizedQuery);
    }) ? 200 : 0;
  }

  function loadSearch() {
    if (searchData) return Promise.resolve(searchData);
    if (!searchPromise && indexUrl) {
      searchPromise = fetch(indexUrl)
        .then(function (response) {
          if (!response.ok) throw new Error('Search index unavailable');
          return response.json();
        })
        .then(function (data) {
          searchData = data.map(function (item) {
            item.haystack = (item.title + ' ' + item.group + ' ' + item.text).toLocaleLowerCase();
            item.normalizedAliases = (item.aliases || []).map(normalizeAlias);
            return item;
          });
          return searchData;
        }).catch(function (error) {
          searchPromise = null;
          throw error;
        });
    }
    return searchPromise || Promise.resolve([]);
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function runSearch() {
    if (!input || !results) return;
    const query = input.value.trim().toLocaleLowerCase();
    if (query.length < 2) {
      results.hidden = true;
      results.innerHTML = '';
      return;
    }
    loadSearch().then(function (rows) {
      const terms = query.split(/\s+/).filter(Boolean);
      const normalizedQuery = normalizeAlias(query);
      if (input.value.trim().toLocaleLowerCase() !== query) return;
      function relevance(row) {
        const title = row.title.toLocaleLowerCase();
        const group = row.group.toLocaleLowerCase();
        return aliasScore(row, normalizedQuery) + (title.includes(query) ? 100 : 0) + terms.reduce(function (score, term) {
          return score + (title.includes(term) ? 10 : 0) + (group.includes(term) ? 3 : 0);
        }, 0);
      }
      const matches = rows.filter(function (row) {
        return aliasScore(row, normalizedQuery) > 0 || terms.every(function (term) { return row.haystack.includes(term); });
      }).sort(function (a, b) { return relevance(b) - relevance(a); }).slice(0, 24);
      results.innerHTML = matches.length
        ? matches.map(function (row) {
            return '<a href="' + row.url + '"><strong>' + escapeHtml(row.title) +
              '</strong><small>' + escapeHtml(row.group) + '</small>' +
              (row.reason ? '<small>' + escapeHtml(row.reason) + '</small>' : '') + '</a>';
          }).join('')
        : '<p class="search-empty">没有找到匹配内容。</p>';
      results.hidden = false;
    }).catch(function () {
      if (input.value.trim().toLocaleLowerCase() !== query) return;
      results.innerHTML = '<p class="search-empty">搜索索引暂时不可用。</p>';
      results.hidden = false;
    });
  }

  if (input) {
    input.addEventListener('focus', function () { loadSearch().catch(function () { return null; }); });
    input.addEventListener('input', runSearch);
  }

  document.addEventListener('keydown', function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k' && input) {
      event.preventDefault();
      input.focus();
    }
    if (event.key === 'Escape') {
      if (results) results.hidden = true;
      if (sidebar) sidebar.classList.remove('open');
      if (menuButton) {
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.textContent = '目录';
      }
    }
  });

  document.addEventListener('click', function (event) {
    if (search && results && !search.contains(event.target)) results.hidden = true;
  });
})();


// Practical communication controls; all text remains available without JavaScript.
(function () {
  const toolkit = document.querySelector('[data-toolkit]');
  if (toolkit) {
    const filter = toolkit.querySelector('[data-task-filter]');
    const onlySaved = toolkit.querySelector('[data-favorites-only]');
    const status = toolkit.querySelector('[data-toolkit-status]');
    const cards = Array.from(toolkit.querySelectorAll('[data-template]'));
    const expressionSearch = toolkit.querySelector('[data-expression-search]');
    const expressionCount = toolkit.querySelector('[data-expression-count]');
    const isExpressionLibrary = toolkit.hasAttribute('data-expression-library');
    const unsavedLabel = isExpressionLibrary ? '收藏表达' : '收藏模板';
    const itemName = isExpressionLibrary ? '表达' : '模板';
    const searchableText = new Map(cards.map(card => [card, card.textContent.toLocaleLowerCase()]));
    const key = 'learnLanguage.communication.favorites.' + toolkit.dataset.language;
    let favorites = new Set();
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(stored)) favorites = new Set(stored.filter(x => typeof x === 'string'));
    } catch (_) {
      status.textContent = '当前浏览器不能读取收藏；仍可使用和复制模板。';
    }
    function applyFilter() {
      const query = expressionSearch ? expressionSearch.value.trim().toLocaleLowerCase() : '';
      cards.forEach(card => {
        const saved = favorites.has(card.dataset.templateId);
        const button = card.querySelector('[data-save]');
        button.setAttribute('aria-pressed', String(saved));
        button.textContent = saved ? '取消收藏' : unsavedLabel;
        card.hidden = (filter.value !== 'all' && card.dataset.task !== filter.value) || (onlySaved.checked && !saved) || (query && !searchableText.get(card).includes(query));
      });
      const visibleCount = cards.filter(card => !card.hidden).length;
      toolkit.querySelector('[data-empty]').hidden = visibleCount > 0;
      if (expressionCount) expressionCount.textContent = `显示 ${visibleCount} / ${cards.length} 条表达`;
    }
    cards.forEach(card => {
      const field = card.querySelector('[data-template-text]');
      const original = field.value;
      card.querySelector('[data-reset]').addEventListener('click', () => {
        field.value = original;
        status.textContent = isExpressionLibrary ? '已恢复原例句。' : '已恢复原模板。';
      });
      card.querySelector('[data-save]').addEventListener('click', () => {
        const id = card.dataset.templateId;
        favorites.has(id) ? favorites.delete(id) : favorites.add(id);
        try {
          localStorage.setItem(key, JSON.stringify(Array.from(favorites)));
          status.textContent = favorites.has(id) ? `已收藏${itemName}。` : '已取消收藏。';
        } catch (_) {
          status.textContent = '当前浏览器不能保存收藏；本次页面内仍可使用。';
        }
        applyFilter();
      });
      card.querySelector('[data-copy]').addEventListener('click', async () => {
        try {
          if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable');
          await navigator.clipboard.writeText(field.value);
          status.textContent = /\[[^\]]+\]/.test(field.value)
            ? '已复制；发送前请替换方括号中的信息。'
            : '已复制；发送前请核对内容。';
        } catch (_) {
          field.focus();
          field.select();
          status.textContent = '自动复制不可用，已选中文字。请使用系统的复制操作。';
        }
      });
    });
    if (expressionSearch) expressionSearch.addEventListener('input', applyFilter);
    filter.addEventListener('change', applyFilter);
    onlySaved.addEventListener('change', applyFilter);
    applyFilter();
  }

  const lab = document.querySelector('[data-listening-lab]');
  if (!lab) return;
  const status = lab.querySelector('[data-speech-status]');
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    status.textContent = '当前浏览器不支持设备朗读。原文、中文和解读仍可直接阅读。';
    return;
  }
  const synth = window.speechSynthesis;
  const language = lab.querySelector('[data-listening-item]').dataset.language;
  const voiceSelect = lab.querySelector('[data-voice]');
  const rate = lab.querySelector('[data-rate]');
  const speakButtons = Array.from(lab.querySelectorAll('[data-speak]'));
  let voices = [];
  let active = null;
  let generation = 0;
  lab.querySelector('.speech-controls').hidden = false;
  speakButtons.forEach(button => { button.hidden = false; });
  function updateVoices() {
    const selected = voiceSelect.value;
    voices = synth.getVoices().filter(voice => voice.lang.toLowerCase().startsWith(language));
    voiceSelect.replaceChildren();
    voices.forEach(voice => {
      const option = document.createElement('option');
      option.value = voice.voiceURI;
      option.textContent = voice.name + ' (' + voice.lang + ')';
      voiceSelect.appendChild(option);
    });
    if (voices.some(voice => voice.voiceURI === selected)) voiceSelect.value = selected;
    voiceSelect.disabled = voices.length === 0;
    speakButtons.forEach(button => { button.disabled = voices.length === 0; });
    if (!active) status.textContent = voices.length
      ? '可播放设备合成语音。下方原文和中文可直接阅读，也可收起原文后听读。'
      : '未找到相应语言的设备语音。原文、中文和解读仍可直接阅读。';
  }
  function stop() {
    generation += 1;
    synth.cancel();
    active = null;
    speakButtons.forEach(button => button.removeAttribute('aria-current'));
  }
  speakButtons.forEach(button => {
    button.addEventListener('click', () => {
      stop();
      const voice = voices.find(item => item.voiceURI === voiceSelect.value);
      if (!voice) { updateVoices(); return; }
      const item = button.closest('[data-listening-item]');
      active = new SpeechSynthesisUtterance(item.querySelector('[data-speech-text]').textContent);
      active.voice = voice;
      active.lang = voice.lang;
      active.rate = Number(rate.value);
      const ticket = generation;
      button.setAttribute('aria-current', 'true');
      status.textContent = '正在播放：' + item.querySelector('h2').textContent;
      active.onend = () => {
        if (ticket !== generation) return;
        active = null;
        button.removeAttribute('aria-current');
        status.textContent = '播放结束。可以对照原文、中文和回应解读。';
      };
      active.onerror = () => {
        if (ticket !== generation) return;
        active = null;
        button.removeAttribute('aria-current');
        status.textContent = '设备朗读未能完成。可以重试，或直接阅读下方文字。';
      };
      synth.speak(active);
    });
  });
  lab.querySelector('[data-stop]').addEventListener('click', () => {
    stop();
    status.textContent = '已停止播放。';
  });
  window.addEventListener('pagehide', stop);
  synth.addEventListener('voiceschanged', updateVoices);
  updateVoices();
})();


(function () {
  document.querySelectorAll('[data-branch-scenario]').forEach(scenario => {
    const source = scenario.querySelector('[data-branch-source]');
    const player = scenario.querySelector('[data-branch-player]');
    const nodes = new Map(Array.from(source.querySelectorAll('[data-branch-node]')).map(node => [node.dataset.branchNode, node]));
    if (!nodes.has('start') || Array.from(source.querySelectorAll('[data-next]')).some(choice => !nodes.has(choice.dataset.next))) return;
    let path = [{ id: 'start', draft: '' }];
    const content = document.createElement('div');
    content.className = 'branch-current';
    const draftLabel = document.createElement('label');
    draftLabel.textContent = '你的回应（可选，也可以直接选择下面的参考回应）';
    const draft = document.createElement('textarea');
    draft.rows = 3;
    draft.setAttribute('aria-label', scenario.querySelector('h2').textContent + '：自己的回应');
    draftLabel.appendChild(draft);
    const controls = document.createElement('div');
    controls.className = 'branch-controls';
    const back = document.createElement('button');
    back.type = 'button';
    back.textContent = '返回上一步';
    const restart = document.createElement('button');
    restart.type = 'button';
    restart.textContent = '从头重来';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const log = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = '查看本轮对话记录';
    const logList = document.createElement('ol');
    log.append(summary, logList);
    controls.append(back, restart);
    player.append(content, controls, status, log);
    source.hidden = true;
    player.hidden = false;
    function render(focus) {
      const current = path[path.length - 1];
      const node = nodes.get(current.id).cloneNode(true);
      const choices = Array.from(node.querySelectorAll('[data-branch-choice]'));
      content.replaceChildren(node);
      if (choices.length) {
        const list = node.querySelector('ul');
        draft.value = current.draft;
        node.insertBefore(draftLabel, list);
        choices.forEach(choice => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'branch-choice';
          button.textContent = choice.textContent;
          button.dataset.next = choice.dataset.next;
          choice.replaceWith(button);
          button.addEventListener('click', () => {
            current.draft = draft.value;
            current.reply = button.textContent;
            path.push({ id: button.dataset.next, draft: '' });
            render(true);
          });
        });
      }
      back.disabled = path.length === 1;
      status.textContent = choices.length
        ? '已回应 ' + (path.length - 1) + ' 次。可以直接选参考回应，或写下自己的说法。'
        : '本轮走到这里。请看结果说明，也可以返回尝试另一条路。';
      logList.replaceChildren();
      path.forEach(step => {
        const add = (label, text) => {
          const item = document.createElement('li');
          item.textContent = label + text;
          logList.appendChild(item);
        };
        add('对方：', nodes.get(step.id).querySelector('[data-other-line]').textContent);
        if (step.draft.trim()) add('你的草稿：', step.draft);
        if (step.reply) add('你选择的回应：', step.reply);
      });
      if (focus) {
        node.setAttribute('tabindex', '-1');
        node.focus({ preventScroll: true });
        node.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      }
    }
    draft.addEventListener('input', () => { path[path.length - 1].draft = draft.value; });
    back.addEventListener('click', () => {
      if (path.length === 1) return;
      path.pop();
      delete path[path.length - 1].reply;
      render(true);
    });
    restart.addEventListener('click', () => {
      path = [{ id: 'start', draft: '' }];
      log.open = false;
      render(true);
    });
    render(false);
  });
})();

// Whole-article reading records. Separate keys leave existing learning tools intact.
(function () {
  'use strict';
  const track = document.body.dataset.track;
  const tools = document.querySelector('[data-reader-tools]');
  const desk = document.querySelector('[data-reading-dashboard]');
  const summary = document.querySelector('[data-reading-summary]');
  if (!['en', 'de', 'en_vocab', 'de_vocab'].includes(track) || (!tools && !desk && !summary)) return;
  const key = 'learnLanguage.reader.v1.' + track;
  const prefix = '/learnLanguage/' + track + '/';
  const changedElsewhere = '另一标签页已修改这篇笔记。当前输入尚未保存；先复制需要保留的文字，再载入已存笔记。';
  let catalogPromise = null;
  let autoPaused = false;
  function safePath(value) {
    if (typeof value !== 'string' || !value.startsWith(prefix) || !value.endsWith('.html') || /[%][25][efc]|[\\?#]/i.test(value)) return false;
    try { const u = new URL(value, location.origin); return u.origin === location.origin && u.pathname === value && !u.search && !u.hash; } catch (_) { return false; }
  }
  function fail(message) { throw new Error(message); }
  function stored() {
    try { return localStorage.getItem(key); } catch (_) { return fail('浏览器暂时不能读取本区记录。正文仍可阅读，恢复后可重试。'); }
  }
  function read() { return parse(stored()); }
  function parse(raw) {
    const fresh = {version: 1, articles: Object.create(null)};
    if (raw === null) return fresh;
    let data;
    try { data = JSON.parse(raw); } catch (_) { return fail('本区记录格式无法读取，旧数据未被覆盖。请保留本站数据，稍后重试。'); }
    if (!data || data.version !== 1 || !data.articles || typeof data.articles !== 'object' || Array.isArray(data.articles)) return fail('本区记录版本或格式无法读取，旧数据未被覆盖。');
    const rows = Object.entries(data.articles);
    if (rows.length > 2000) return fail('本区记录超出当前可读取范围，旧数据未被覆盖。');
    for (const [path, row] of rows) {
      if (!safePath(path) || !row || typeof row !== 'object' || Array.isArray(row) || typeof row.favorite !== 'boolean' || typeof row.note !== 'string' || row.note.length > 1000 || typeof row.anchor !== 'string' || row.anchor.length > 300 || /[\u0000-\u001f]/.test(row.anchor)) return fail('本区有无法读取的记录，旧数据未被覆盖。');
      const clean = {favorite: row.favorite, note: row.note, anchor: row.anchor};
      for (const field of ['readAt', 'positionAt', 'favoriteAt', 'noteAt']) {
        const value = row[field] === undefined ? 0 : row[field];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 8640000000000000) return fail('本区记录时间格式无法读取，旧数据未被覆盖。');
        clean[field] = value;
      }
      fresh.articles[path] = clean;
    }
    return fresh;
  }
  function empty() { return {favorite: false, note: '', anchor: '', readAt: 0, positionAt: 0, favoriteAt: 0, noteAt: 0}; }
  function write(data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (_) { return fail('保存未成功，浏览器可能禁止保存或空间不足。当前输入仍在，请保留文字后重试。'); }
    autoPaused = false;
  }
  function edit(path, change) {
    const data = read(), row = data.articles[path] || empty();
    change(row); data.articles[path] = row; write(data); return row;
  }
  function element(tag, text, className) {
    const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e;
  }
  function link(label, url) { const a = element('a', label); a.href = url; return a; }
  function time(value) { return value ? new Date(value).toLocaleDateString('zh-CN') : ''; }
  function catalog() {
    if (!catalogPromise) catalogPromise = fetch(document.body.dataset.readingCatalog || '/learnLanguage/assets/reading-' + track + '.json').then(r => {
      if (!r.ok) throw Error('目录暂时未能载入；说明和主题链接仍可阅读，请重试。'); return r.json();
    }).then(rows => {
      if (!Array.isArray(rows)) throw Error('目录暂时无法读取，请重试。');
      const map = new Map();
      rows.forEach(row => {
        if (!row || !safePath(row.url) || typeof row.title !== 'string' || typeof row.topic !== 'string' || typeof row.topicTitle !== 'string' || !Array.isArray(row.headings) || row.headings.some(h => typeof h.id !== 'string' || typeof h.title !== 'string') || map.has(row.url)) throw Error('目录暂时无法读取，请重试。');
        map.set(row.url, row);
      }); return map;
    }).catch(error => { catalogPromise = null; throw error; });
    return catalogPromise;
  }
  function destination(path, row, meta) {
    const h = meta.headings.find(h => h.id === row.anchor);
    return {url: path + (h ? '#' + encodeURIComponent(h.id) : ''), label: h ? h.title : (row.anchor ? '原小节已调整，返回篇首' : '篇首')};
  }
  function latest(data, map) {
    return Object.entries(data.articles).filter(([p, r]) => r.readAt > 0 && map.has(p)).sort((a, b) => b[1].readAt - a[1].readAt || a[0].localeCompare(b[0]))[0];
  }
  // Backup uses the same path/schema validator and only the current track key.
  function setupBackup(refreshDesk) {
    const host = desk.querySelector('[data-reading-backup]');
    if (!host) return;
    const file = host.querySelector('[data-backup-file]'), previewButton = host.querySelector('[data-backup-preview]'), apply = host.querySelector('[data-backup-apply]'), cancel = host.querySelector('[data-backup-cancel]'), output = host.querySelector('[data-backup-details]'), status = host.querySelector('[data-backup-status]');
    let pending = null, sequence = 0;
    function reset(message) {
      sequence++; pending = null; apply.disabled = true; previewButton.disabled = false; output.replaceChildren();
      if (message) status.textContent = message;
    }
    function merge(base, incoming, choices) {
      const result = parse(JSON.stringify(base));
      for (const [path, row] of Object.entries(incoming.articles)) {
        const old = result.articles[path];
        if (!old) { result.articles[path] = {...row}; continue; }
        if (row.favoriteAt > old.favoriteAt) { old.favorite = row.favorite; old.favoriteAt = row.favoriteAt; }
        if (row.positionAt > old.positionAt) { old.anchor = row.anchor; old.positionAt = row.positionAt; }
        old.readAt = Math.max(old.readAt, row.readAt);
        if (!old.note && row.note) { old.note = row.note; old.noteAt = row.noteAt; }
        else if (old.note === row.note) old.noteAt = Math.max(old.noteAt, row.noteAt);
        else if (old.note && row.note) {
          const choice = choices.get(path);
          if (choice && choice.value === 'backup') { old.note = row.note; old.noteAt = Date.now(); }
          else if (choice && choice.value === 'both') { old.note += '\n\n——备份中的笔记——\n' + row.note; old.noteAt = Date.now(); }
        }
      }
      // The combined result must satisfy the same limits as ordinary records.
      return parse(JSON.stringify(result));
    }
    host.querySelector('[data-backup-export]').addEventListener('click', () => {
      try {
        const data = read(), pack = {format: 'learnLanguage-reading-backup', version: 1, track, exportedAt: new Date().toISOString(), data};
        const blob = new Blob([JSON.stringify(pack, null, 2) + '\n'], {type: 'application/json'}), url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = 'learnLanguage-' + track + '-reading-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
        status.textContent = '已将本区 ' + Object.keys(data.articles).length + ' 篇记录交给浏览器下载。请检查文件是否已保存；其中含有已保存的笔记，不含其他区或旧工具记录。';
      } catch (e) { status.textContent = '未能导出：' + e.message; }
    });
    file.addEventListener('change', () => reset(file.files.length ? '已选择文件。点击“预览备份”检查内容，当前记录尚未改变。' : '没有选择文件，当前记录未改变。'));
    cancel.addEventListener('click', () => { reset('已取消预览，当前记录未改变。'); file.value = ''; file.focus(); });
    previewButton.addEventListener('click', async () => {
      reset(); const current = sequence, selected = file.files[0];
      if (!selected) { status.textContent = '请先选择本区导出的备份文件。'; file.focus(); return; }
      previewButton.disabled = true; status.textContent = '正在本机检查备份，当前记录尚未改变…';
      try {
        if (selected.size > 8 * 1024 * 1024) throw Error('文件超过8MB，请选择本工具导出的单区备份。');
        let pack; try { pack = JSON.parse((await selected.text()).replace(/^\uFEFF/, '')); } catch (_) { throw Error('文件不是可读取的备份格式。'); }
        if (!pack || pack.format !== 'learnLanguage-reading-backup' || pack.version !== 1) throw Error('不支持这个备份格式或版本。');
        if (pack.track !== track) throw Error('备份不属于本区。请到对应的英语、德语或词汇阅读记录入口恢复。');
        if (typeof pack.exportedAt !== 'string' || !Number.isFinite(Date.parse(pack.exportedAt))) throw Error('备份日期格式无法读取。');
        const incoming = parse(JSON.stringify(pack.data)), map = await catalog();
        if (current !== sequence) return;
        const raw = stored(), base = parse(raw), choices = new Map(), entries = Object.entries(incoming.articles);
        let added = 0, unavailable = 0, conflicts = 0;
        for (const [path, row] of entries) {
          const old = base.articles[path]; if (!old) added++; if (!map.has(path)) unavailable++;
          if (!old || !old.note || !row.note || old.note === row.note) continue;
          conflicts++;
          const section = element('section', undefined, 'backup-conflict'), title = map.has(path) ? map.get(path).title : path;
          section.append(element('h4', title), element('p', '当前笔记：' + old.note, 'reading-note-text'), element('p', '备份笔记：' + row.note, 'reading-note-text'));
          const label = element('label', '这篇笔记怎样处理'), select = document.createElement('select');
          select.setAttribute('data-backup-choice', ''); select.setAttribute('aria-label', '笔记处理：' + title);
          select.add(new Option('保留当前笔记', 'current')); select.add(new Option('使用备份笔记', 'backup'));
          if ((old.note + '\n\n——备份中的笔记——\n' + row.note).length <= 1000) select.add(new Option('合并保留两份', 'both'));
          else section.append(element('p', '两份合并超过1000字，本次不能合并。请先导出当前记录，保留两份文件后再选择。'));
          label.append(select); section.append(label); output.append(section); choices.set(path, select);
        }
        // Check combined path count before offering to apply, without writing.
        merge(base, incoming, choices);
        const detail = element('p', '备份共 ' + entries.length + ' 篇，将新增 ' + added + ' 篇，合并已有 ' + (entries.length - added) + ' 篇；不同笔记 ' + conflicts + ' 篇。' + (unavailable ? '其中 ' + unavailable + ' 篇暂不在目录，仍保留记录，当前无法从目录打开。' : ''));
        output.prepend(detail); pending = {raw, base, incoming, choices}; apply.disabled = false;
        status.textContent = '预览完成，当前记录尚未改变。不同笔记默认保留当前内容；确认各项选择后点击“合并恢复”。';
      } catch (e) { if (current === sequence) { pending = null; output.replaceChildren(); status.textContent = '无法预览：' + e.message + ' 当前记录未改变。'; } }
      finally { if (current === sequence) previewButton.disabled = false; }
    });
    apply.addEventListener('click', () => {
      if (!pending) return;
      try {
        if (stored() !== pending.raw) { reset('当前记录在预览后发生了变化。请重新预览，避免覆盖新内容。'); return; }
        const merged = merge(pending.base, pending.incoming, pending.choices);
        const same = JSON.stringify(merged) === JSON.stringify(pending.base);
        if (!same) write(merged);
        pending = null; apply.disabled = true; output.replaceChildren(); file.value = ''; refreshDesk();
        status.textContent = same ? '与当前记录一致，无需写入。其他区和旧工具记录未改变。' : '本区记录已合并恢复。其他区和旧工具记录未改变；请保留备份文件，需要时还可再次预览。';
      } catch (e) { status.textContent = '恢复未成功：' + e.message + ' 当前预览仍保留，处理后可重试。'; }
    });
    addEventListener('storage', e => { if ((e.key === key || e.key === null) && (pending || previewButton.disabled)) reset('本区记录已在另一标签页改变。请重新预览，再决定怎样合并。'); });
  }

  if (tools) {
    tools.hidden = false;
    const path = tools.dataset.url;
    if (!safePath(path)) return;
    const favorite = tools.querySelector('[data-reader-favorite]'), note = tools.querySelector('[data-reader-note]'), save = tools.querySelector('[data-reader-save]'), status = tools.querySelector('[data-reader-status]'), resume = tools.querySelector('[data-reader-resume]'), remember = tools.querySelector('[data-reader-remember]'), reload = tools.querySelector('[data-reader-reload]'), retry = tools.querySelector('[data-reader-retry]'), position = tools.querySelector('[data-reader-position]');
    let baseline = '', dirty = false, lastAnchor = null, lastTime = 0;
    const headings = Array.from(document.querySelectorAll('article.prose h2[id], article.prose h3[id]'));
    function currentAnchor() {
      if (headings.length && scrollY + innerHeight >= document.documentElement.scrollHeight - 3) return headings[headings.length - 1].id;
      let selected = ''; for (const h of headings) { if (h.getBoundingClientRect().top <= 150) selected = h.id; else break; } return selected;
    }
    function error(e) { status.textContent = e.message || '记录暂时不可用，请重试。'; retry.hidden = false; autoPaused = true; }
    function refresh(row) {
      favorite.setAttribute('aria-pressed', String(row.favorite)); favorite.textContent = row.favorite ? '已收藏 · 取消' : '收藏本文';
      if (!dirty) { note.value = row.note; baseline = row.note; }
      const h = headings.find(h => h.id === row.anchor);
      resume.hidden = !row.positionAt; resume.href = path + (h ? '#' + encodeURIComponent(h.id) : '');
      position.textContent = row.positionAt ? '已记住：' + (h ? h.textContent : row.anchor ? '原小节已调整，回到篇首' : '篇首') : '尚未记住本篇位置。';
    }
    function readView() { try { refresh(read().articles[path] || empty()); status.textContent = dirty ? '当前修改尚未保存。' : '本区记录保存在当前浏览器。'; retry.hidden = true; autoPaused = false; } catch (e) { error(e); } }
    readView();
    favorite.addEventListener('click', () => { try { const row = edit(path, row => { row.favorite = !row.favorite; row.favoriteAt = Date.now(); }); refresh(row); status.textContent = row.favorite ? '已收藏本文。' : '已取消本文收藏。'; retry.hidden = true; } catch (e) { error(e); } });
    note.addEventListener('input', () => { dirty = note.value !== baseline; status.textContent = dirty ? '当前修改尚未保存；离开前请点击保存。' : '与已存笔记一致。'; });
    function saveNote() {
      try {
        const row = edit(path, row => { if (row.note !== baseline && row.note !== note.value) return fail(changedElsewhere); row.note = note.value; row.noteAt = Date.now(); });
        baseline = row.note; dirty = false; refresh(row); reload.hidden = true; retry.hidden = true; status.textContent = row.note ? '笔记已保存到本浏览器。' : '笔记已清空，其他记录保留。';
      } catch (e) { if (e.message === changedElsewhere) reload.hidden = false; error(e); }
    }
    save.addEventListener('click', saveNote);
    note.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveNote(); } });
    reload.addEventListener('click', () => { try { const row = read().articles[path] || empty(); dirty = false; refresh(row); reload.hidden = true; retry.hidden = true; autoPaused = false; status.textContent = '已载入另一标签页保存的笔记。'; note.focus(); } catch (e) { error(e); } });
    retry.addEventListener('click', readView);
    function keep(manual, exiting) {
      if (!manual && (autoPaused || tools.dataset.continue !== 'true' || (document.visibilityState === 'hidden' && !exiting))) return;
      const anchor = currentAnchor(), now = Date.now();
      if (!manual && anchor === lastAnchor && now - lastTime < 30000) return;
      try {
        const row = edit(path, row => { if (anchor || manual || !row.positionAt) { row.anchor = anchor; row.positionAt = now; } if (!exiting) row.readAt = now; }); lastAnchor = anchor; lastTime = now; refresh(row);
        if (manual) { status.textContent = '已记住当前位置；可以从本区阅读记录继续。'; retry.hidden = true; }
      } catch (e) { error(e); }
    }
    remember.addEventListener('click', () => keep(true));
    let scrollTimer;
    addEventListener('scroll', () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(() => keep(false), 700); }, {passive: true});
    setTimeout(() => keep(false), 1200);
    addEventListener('pagehide', () => { if (!autoPaused && tools.dataset.continue === 'true') keep(false, true); });
    addEventListener('storage', e => {
      if (e.key !== key && e.key !== null) return;
      try { const row = read().articles[path] || empty(); if (dirty && row.note !== baseline) { reload.hidden = false; status.textContent = changedElsewhere; } refresh(row); } catch (err) { error(err); }
    });
  }
  if (desk || summary) {
    const host = desk || summary, status = host.querySelector('[data-reading-status]'), retry = host.querySelector('[data-reading-retry]'), continuation = host.querySelector('[data-reading-continue]');
    let map = null, token = 0;
    if (desk) desk.hidden = false;
    if (summary) summary.hidden = false;
    const range = desk && desk.querySelector('[data-reading-range]'), topic = desk && desk.querySelector('[data-reading-topic]'), list = desk && desk.querySelector('[data-reading-list]');
    function render() {
      const data = read(), last = latest(data, map); continuation.replaceChildren();
      if (last) { const [path, row] = last, meta = map.get(path), to = destination(path, row, meta); continuation.append(link('继续阅读：' + meta.title, to.url), element('span', '记住的位置：' + to.label, 'reading-position')); }
      else continuation.append(element('p', '还没有本区阅读位置。先选一篇正文，或在文章里记住当前位置。'));
      if (!desk) { status.textContent = '只显示本区在当前浏览器的记录。'; return; }
      const saved = Object.entries(data.articles).filter(([p, r]) => map.has(p) && (r.favorite || r.note || r.readAt));
      const selected = saved.filter(([p, r]) => (!topic.value || map.get(p).topic === topic.value) && (range.value !== 'favorites' || r.favorite) && (range.value !== 'notes' || r.note) && (range.value !== 'recent' || r.readAt));
      selected.sort((a, b) => Math.max(b[1].readAt, b[1].noteAt, b[1].favoriteAt) - Math.max(a[1].readAt, a[1].noteAt, a[1].favoriteAt) || a[0].localeCompare(b[0]));
      list.replaceChildren();
      const groups = new Map();
      selected.forEach(([path, row]) => { const meta = map.get(path); if (!groups.has(meta.topic)) groups.set(meta.topic, []); groups.get(meta.topic).push([path, row, meta]); });
      groups.forEach(items => {
        const section = element('section'), h = element('h3', items[0][2].topicTitle), ul = element('ul'); section.append(h, ul);
        items.forEach(([path, row, meta]) => {
          const li = element('li'), to = destination(path, row, meta); li.append(link(meta.title, row.readAt ? to.url : path));
          li.append(element('p', [row.favorite ? '已收藏' : '', row.readAt ? '读过 ' + time(row.readAt) : '', row.note ? '有笔记' : ''].filter(Boolean).join(' · '), 'reading-meta'));
          if (row.readAt) li.append(element('p', '阅读位置：' + to.label, 'reading-meta'));
          if (row.note) li.append(element('p', row.note, 'reading-note-text'));
          if (row.favorite) {
            const button = element('button', '取消本篇收藏'); button.type = 'button'; button.setAttribute('aria-label', '取消收藏：' + meta.title);
            button.addEventListener('click', () => { try { edit(path, r => { r.favorite = false; r.favoriteAt = Date.now(); }); render(); status.textContent = '已取消收藏，笔记和阅读位置保留。'; range.focus(); } catch (e) { showError(e); } }); li.append(button);
          }
          ul.append(li);
        }); list.append(section);
      });
      if (!selected.length) list.append(element('p', saved.length ? '当前筛选下没有记录，可以换一个主题或范围。' : '这里还没有记录。先打开一篇文章，再收藏或保存笔记。'));
      const unavailable = Object.keys(data.articles).filter(p => !map.has(p)).length;
      status.textContent = '本区共 ' + saved.length + ' 篇有记录，当前显示 ' + selected.length + ' 篇。' + (unavailable ? ' 另有 ' + unavailable + ' 篇暂不在当前目录，原记录保留。' : '');
    }
    function showError(e) { status.textContent = e.message || '记录暂时未能载入，请重试。'; retry.hidden = false; }
    async function load() {
      const current = ++token; status.textContent = '正在读取本区记录…';
      try {
        const loaded = await catalog(); if (current !== token) return; map = loaded;
        if (desk && !topic.options.length) {
          topic.add(new Option('全部主题', '')); const groups = new Map(); map.forEach(row => groups.set(row.topic, row.topicTitle)); groups.forEach((title, id) => topic.add(new Option(title, id)));
        }
        if (desk) { range.disabled = false; topic.disabled = false; }
        render(); retry.hidden = true;
      } catch (e) { if (current === token) showError(e); }
    }
    retry.addEventListener('click', load);
    if (desk) [range, topic].forEach(control => control.addEventListener('change', () => { try { render(); } catch (e) { showError(e); } }));
    addEventListener('storage', e => { if ((e.key === key || e.key === null) && map) { try { render(); } catch (err) { showError(err); } } });
    if (desk) setupBackup(load);
    load();
  }
})();
