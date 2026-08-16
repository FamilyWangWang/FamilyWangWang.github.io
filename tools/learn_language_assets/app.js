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
