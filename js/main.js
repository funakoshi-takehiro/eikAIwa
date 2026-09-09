/* ── 起動 ──────────────────────────────────────────────────────────────── */
'use strict';

/* 表示設定（テーマ・文字サイズ・行間）を <html> の属性に反映する */
EIK.applyDisplaySettings = function () {
  var st = EIK.Store.settings();
  var root = document.documentElement;

  var theme = st.theme;
  if (theme === 'auto') {
    root.removeAttribute('data-theme');
    // auto のときは OS 設定に追従させる
    var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) root.setAttribute('data-theme', 'dark');
  } else {
    root.setAttribute('data-theme', theme);
  }

  root.setAttribute('data-text', st.textSize || 'm');
  root.setAttribute('data-line', st.lineHeight || 'm');

  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    var isDark = root.getAttribute('data-theme') === 'dark';
    meta.setAttribute('content', isDark ? '#12161a' : '#028DAE');
  }
};

(function boot() {
  EIK.applyDisplaySettings();

  // OS のテーマ変更に追従（設定が auto のときだけ）
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () {
      if (EIK.Store.settings().theme === 'auto') EIK.applyDisplaySettings();
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  // Android/Chrome のインストール導線
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    EIK.deferredPrompt = e;
  });

  EIK.Router.start();

  // Service Worker（オフライン動作の要）
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      /* 初回インストールかどうかを、登録より前に確定させておく。
         updatefound は初回インストールでも発火し、その頃には clients.claim() で
         controller が埋まっていることがある。controller の有無だけで判定すると
         初回訪問なのに「新しい版が公開されています」バーが出る（実測で踏んだ）。 */
      var wasControlled = !!navigator.serviceWorker.controller;

      navigator.serviceWorker.register(EIK.url('sw.js'), { scope: EIK.siteBase })
        .then(function (reg) {
          // 前回の訪問で用意され、待機したままの版があることもある
          if (reg.waiting && wasControlled) showUpdateBar(reg);

          // 新しい版が用意できたら再読み込みを促すバーを出す
          reg.addEventListener('updatefound', function () {
            var sw = reg.installing;
            if (!sw) return;
            sw.addEventListener('statechange', function () {
              if (sw.state === 'installed' && wasControlled) {
                showUpdateBar(reg);
              }
            });
          });
        })
        .catch(function (e) {
          // 失敗してもオンラインなら通常どおり動く
          console.warn('Service Worker を登録できませんでした', e);
        });

      /* controllerchange での自動リロードは「すでに SW に管理されていたページが
         新しい SW に切り替わったとき」だけにする。
         初回訪問では install→skipWaiting→claim で必ず controllerchange が起きるため、
         無条件にリロードすると、開いた直後に画面が再読み込みされ、
         直前の操作（保存待ちの学習記録）が失われる。実測で踏んだ。 */
      var refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!wasControlled || refreshing) return;
        refreshing = true;
        location.reload();
      });
    });
  }

  /* 更新バーは複数回呼ばれうる（waiting の検出と updatefound の両方）。
     そのたびに listener を足すと、1回の押下で何度も切り替えが走る。 */
  var barWired = false;
  function showUpdateBar(reg) {
    var bar = document.getElementById('update-bar');
    var btn = document.getElementById('update-reload');
    if (!bar || !btn) return;
    bar.hidden = false;
    if (barWired) return;
    barWired = true;
    btn.addEventListener('click', function () {
      btn.disabled = true;
      // 待機中の版に切り替えを指示する。activate → claim → controllerchange
      // と進み、下の listener が reload する。
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      else location.reload();
    });
  }
})();
