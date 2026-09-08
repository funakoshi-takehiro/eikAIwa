/* ── インストール案内 ─────────────────────────────────────────────────── */
'use strict';
EIK.Views = EIK.Views || {};

EIK.Views.Install = function (ctx) {
  var app = ctx.app;
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var standalone = window.matchMedia('(display-mode: standalone)').matches ||
                   window.navigator.standalone === true;

  var installed = standalone
    ? '<div class="card" style="border-color:var(--accent-border);background:var(--accent-soft)">' +
      '<p style="font-weight:700;color:var(--accent-dk)">すでにホーム画面から起動しています。</p>' +
      '<p class="small" style="margin-top:6px;color:var(--ink-3)">機内モードでも学習できます。</p></div>'
    : '';

  app.innerHTML = '<div class="stack-lg fade-in">' + installed +

    '<div class="card">' +
      '<div class="eyebrow">Install</div>' +
      '<h2 style="font-size:1.1rem;font-weight:700;margin-top:6px">ホーム画面に追加する</h2>' +
      '<p class="small muted" style="margin-top:8px">' +
        '追加すると、ふつうのアプリのように起動でき、<b>通信がなくても学習できます</b>。' +
      '</p>' +
    '</div>' +

    '<div class="card">' +
      '<div class="section-title">' + (isIOS ? 'iPhone / iPad' : 'iPhone / iPad の場合') + '</div>' +
      '<ol style="padding-left:1.2em;font-size:.9rem;line-height:1.9">' +
        '<li><b>Safari</b> でこのページを開きます（Chrome では追加できません）</li>' +
        '<li>画面下の<b>共有ボタン</b>（□に↑）をタップ</li>' +
        '<li>メニューを下にスクロールして<b>「ホーム画面に追加」</b></li>' +
        '<li>右上の<b>「追加」</b>をタップ</li>' +
      '</ol>' +
    '</div>' +

    '<div class="card">' +
      '<div class="section-title">Android の場合</div>' +
      '<ol style="padding-left:1.2em;font-size:.9rem;line-height:1.9">' +
        '<li><b>Chrome</b> でこのページを開きます</li>' +
        '<li>右上の<b>︙</b>メニューをタップ</li>' +
        '<li><b>「アプリをインストール」</b>または「ホーム画面に追加」</li>' +
      '</ol>' +
      '<div id="installslot" style="margin-top:14px"></div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="section-title">オフラインについて</div>' +
      '<p class="small muted">' +
        '一度開いた後は、問題データも含めて端末に保存されます。' +
        '地下鉄や機内でもそのまま練習できます。読み上げは端末内蔵の音声を使うため、' +
        'こちらもオフラインで動作します（音声が入っていない端末では読み上げボタンは出ません）。' +
      '</p>' +
    '</div>' +

    '<a class="btn btn-ghost btn-block" href="#/">ホームへ戻る</a>' +
  '</div>';

  // Android/Chrome の beforeinstallprompt を捕まえていればボタンを出す
  var slot = app.querySelector('#installslot');
  if (EIK.deferredPrompt && slot) {
    var b = EIK.el('button', 'btn btn-primary btn-block', 'このアプリをインストール');
    b.type = 'button';
    b.addEventListener('click', function () {
      var p = EIK.deferredPrompt;
      if (!p) return;
      p.prompt();
      p.userChoice.then(function () { EIK.deferredPrompt = null; b.remove(); });
    });
    slot.appendChild(b);
  }
};
