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
            return item;
          });
          return searchData;
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
      const matches = rows.filter(function (row) {
        return terms.every(function (term) { return row.haystack.includes(term); });
      }).slice(0, 24);
      results.innerHTML = matches.length
        ? matches.map(function (row) {
            return '<a href="' + row.url + '"><strong>' + escapeHtml(row.title) +
              '</strong><small>' + escapeHtml(row.group) + '</small></a>';
          }).join('')
        : '<p class="search-empty">没有找到匹配内容。</p>';
      results.hidden = false;
    }).catch(function () {
      results.innerHTML = '<p class="search-empty">搜索索引暂时不可用。</p>';
      results.hidden = false;
    });
  }

  if (input) {
    input.addEventListener('focus', loadSearch);
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
    const key = 'learnLanguage.communication.favorites.' + toolkit.dataset.language;
    let favorites = new Set();
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(stored)) favorites = new Set(stored.filter(x => typeof x === 'string'));
    } catch (_) {
      status.textContent = '当前浏览器不能读取收藏；仍可使用和复制模板。';
    }
    function applyFilter() {
      cards.forEach(card => {
        const saved = favorites.has(card.dataset.templateId);
        const button = card.querySelector('[data-save]');
        button.setAttribute('aria-pressed', String(saved));
        button.textContent = saved ? '取消收藏' : '收藏模板';
        card.hidden = (filter.value !== 'all' && card.dataset.task !== filter.value) || (onlySaved.checked && !saved);
      });
      toolkit.querySelector('[data-empty]').hidden = cards.some(card => !card.hidden);
    }
    cards.forEach(card => {
      const field = card.querySelector('[data-template-text]');
      const original = field.value;
      card.querySelector('[data-reset]').addEventListener('click', () => {
        field.value = original;
        status.textContent = '已恢复原模板。';
      });
      card.querySelector('[data-save]').addEventListener('click', () => {
        const id = card.dataset.templateId;
        favorites.has(id) ? favorites.delete(id) : favorites.add(id);
        try {
          localStorage.setItem(key, JSON.stringify(Array.from(favorites)));
          status.textContent = favorites.has(id) ? '已收藏模板。' : '已取消收藏。';
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
    filter.addEventListener('change', applyFilter);
    onlySaved.addEventListener('change', applyFilter);
    applyFilter();
  }

  const lab = document.querySelector('[data-listening-lab]');
  if (!lab) return;
  const status = lab.querySelector('[data-speech-status]');
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    status.textContent = '当前浏览器不支持设备朗读。可以展开文字，练习提取信息和回应。';
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
      ? '可播放设备合成语音。先读问题，再播放留言；文字和答案在下方折叠区。'
      : '未找到相应语言的设备语音。可安装设备的语言语音后重开本页，或展开文字练习。';
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
        status.textContent = '播放结束。请先自己回应，再展开答案。';
      };
      active.onerror = () => {
        if (ticket !== generation) return;
        active = null;
        button.removeAttribute('aria-current');
        status.textContent = '设备朗读未能完成。请重试或展开文字练习。';
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
    draftLabel.textContent = '先写自己的回应，再参考下面的选项（也可以先说出来）';
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
        ? '已回应 ' + (path.length - 1) + ' 次。先尝试自己的说法，再选一句继续。'
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
