/* ── ルータ（ハッシュ方式） ────────────────────────────────────────────────
   GitHub Pages のサブパス配信で最も事故が少ないのでハッシュを使う。
   サーバ側のリライト設定が要らず、404.html も不要。
   ────────────────────────────────────────────────────────────────────────── */
'use strict';

EIK.Router = (function () {
  var ROUTES = [
    { re: /^\/?$/,                          view: 'Home',       tab: 'home'       },
    { re: /^\/categories$/,                 view: 'Categories', tab: 'categories' },
    { re: /^\/categories\/([^/]+)$/,        view: 'Category',   tab: 'categories', keys: ['id'] },
    { re: /^\/bookmarks$/,                  view: 'Bookmarks',  tab: 'bookmarks'  },
    { re: /^\/settings$/,                   view: 'Settings',   tab: 'settings'   },
    { re: /^\/install$/,                    view: 'Install',    tab: 'settings'   },
    { re: /^\/practice\/([^/]+)$/,          view: 'Practice',   tab: 'home', keys: ['mode'] },
    { re: /^\/practice\/([^/]+)\/([^/]+)$/, view: 'Practice',   tab: 'home', keys: ['mode', 'arg'] }
  ];

  function current() {
    var h = location.hash.replace(/^#/, '');
    return h || '/';
  }

  /* 経路は必ず / で始まる。それ以外のハッシュはページ内アンカー
     （index.html のスキップリンク #main など）なので、経路として扱わない。
     以前はこれを経路と解釈し、「本文へスキップ」を押すと
     「ページが見つかりません」で本文が消えていた。 */
  function isRoutePath(path) {
    return path.charAt(0) === '/';
  }

  function resolve(path) {
    for (var i = 0; i < ROUTES.length; i++) {
      var m = path.match(ROUTES[i].re);
      if (!m) continue;
      var params = {};
      var bad = false;
      (ROUTES[i].keys || []).forEach(function (k, j) {
        // 壊れた percent エスケープ（#/categories/% など）で
        // decodeURIComponent は例外を投げる。ここで受けないと
        // render() の外まで抜けて、画面が前のまま固まる。
        try {
          params[k] = decodeURIComponent(m[j + 1]);
        } catch (e) {
          bad = true;
        }
      });
      if (bad) return null;
      return { route: ROUTES[i], params: params };
    }
    return null;
  }

  function render() {
    var path = current();
    if (!isRoutePath(path)) return;   // ページ内アンカー。本文はそのまま
    renderPath(path);
  }

  function renderPath(path) {
    var app = document.getElementById('app');
    var hit = resolve(path);

    EIK.TTS.stop();

    if (!hit) {
      app.innerHTML = '<div class="card empty">ページが見つかりません。' +
        '<div style="margin-top:16px"><a class="btn btn-ghost" href="#/">ホームへ</a></div></div>';
      setTab('');
      return;
    }

    setTab(hit.route.tab);
    var fn = EIK.Views[hit.route.view];
    if (typeof fn !== 'function') {
      app.innerHTML = '<div class="card empty">画面を読み込めませんでした（' +
        EIK.escapeHtml(hit.route.view) + '）。</div>';
      return;
    }
    try {
      fn({ app: app, params: hit.params, path: path });
    } catch (e) {
      console.error(e);
      app.innerHTML = '<div class="card empty">画面の表示中にエラーが発生しました。<br>' +
        EIK.escapeHtml(e.message || e) + '</div>';
    }
  }

  function setTab(tab) {
    Array.prototype.forEach.call(document.querySelectorAll('.tabbar__item'), function (a) {
      if (a.getAttribute('data-tab') === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function start() {
    window.addEventListener('hashchange', function () {
      if (!isRoutePath(current())) return;   // #main などは経路ではない
      window.scrollTo({ top: 0, behavior: 'auto' });
      render();
    });
    if (!location.hash) location.hash = '#/';
    // 初回だけは、ページ内アンカー付きの URL で開かれてもホームを描く。
    // ここで早期 return すると「読み込み中…」のまま止まってしまう。
    renderPath(isRoutePath(current()) ? current() : '/');
  }

  return { start: start, render: render, current: current };
})();
