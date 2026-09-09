/* ── 設定 ──────────────────────────────────────────────────────────────── */
'use strict';
EIK.Views = EIK.Views || {};

EIK.Views.Settings = function (ctx) {
  var app = ctx.app;
  var st = EIK.Store.settings();

  function seg(name, options, current) {
    return '<div class="seg" role="group">' + options.map(function (o) {
      return '<button type="button" class="seg__btn" data-set="' + name + '" data-val="' + o.v +
             '" aria-pressed="' + (String(current) === String(o.v) ? 'true' : 'false') + '">' +
             EIK.escapeHtml(o.l) + '</button>';
    }).join('') + '</div>';
  }

  function sw(name, on) {
    return '<label class="switch">' +
      '<input type="checkbox" data-toggle="' + name + '"' + (on ? ' checked' : '') + '>' +
      '<span class="switch__track"></span><span class="switch__thumb"></span></label>';
  }

  function row(nameTxt, desc, ctl) {
    return '<div class="setrow"><div class="setrow__body">' +
      '<div class="setrow__name">' + nameTxt + '</div>' +
      (desc ? '<div class="setrow__desc">' + desc + '</div>' : '') +
      '</div><div class="setrow__ctl">' + ctl + '</div></div>';
  }

  var voiceOpts = '<option value="">自動で選ぶ</option>' + EIK.TTS.voices().map(function (v) {
    return '<option value="' + EIK.escapeHtml(v.voiceURI) + '"' +
           (st.ttsVoice === v.voiceURI ? ' selected' : '') + '>' +
           EIK.escapeHtml(v.name + ' (' + v.lang + ')') + '</option>';
  }).join('');

  app.innerHTML = '<div class="stack-lg fade-in">' +

    '<div class="card">' +
      '<div class="section-title">学習</div>' +
      row('状況の日本語訳', '既定で表示する。オフならタップで開けます。', sw('showJa', st.showJa)) +
      row('考える時間', 'カウントダウンの秒数', seg('countdown', [
        { v: 0, l: 'なし' }, { v: 5, l: '5秒' }, { v: 10, l: '10秒' }, { v: 20, l: '20秒' }
      ], st.countdown)) +
      row('自分の答えのメモ欄', '練習中に入力欄を出す', sw('showMyAnswer', st.showMyAnswer)) +
      row('1回の問題数', '「今日の練習」で出す問題数', seg('dailyGoal', [
        { v: 5, l: '5' }, { v: 10, l: '10' }, { v: 20, l: '20' }, { v: 30, l: '30' }
      ], st.dailyGoal)) +
    '</div>' +

    '<div class="card">' +
      '<div class="section-title">読み上げ</div>' +
      (EIK.TTS.usable()
        ? row('音声', '端末に入っている英語の音声', '<select class="sel" data-select="ttsVoice">' + voiceOpts + '</select>') +
          row('速さ', '', seg('ttsRate', [
            { v: 0.7, l: 'ゆっくり' }, { v: 0.95, l: 'ふつう' }, { v: 1.15, l: 'はやい' }
          ], st.ttsRate))
        : '<p class="small muted">この端末では読み上げを利用できません。</p>') +
    '</div>' +

    '<div class="card">' +
      '<div class="section-title">表示</div>' +
      row('テーマ', '', seg('theme', [
        { v: 'auto', l: '端末に合わせる' }, { v: 'light', l: 'ライト' }, { v: 'dark', l: 'ダーク' }
      ], st.theme)) +
      row('文字の大きさ', '', seg('textSize', [
        { v: 's', l: '小' }, { v: 'm', l: '標準' }, { v: 'l', l: '大' }, { v: 'xl', l: '特大' }
      ], st.textSize)) +
      row('行の間隔', '', seg('lineHeight', [
        { v: 's', l: '狭い' }, { v: 'm', l: '標準' }, { v: 'l', l: '広い' }
      ], st.lineHeight)) +
    '</div>' +

    '<div class="card">' +
      '<div class="section-title">学習データ</div>' +
      '<p class="small muted" style="margin-bottom:14px">' +
        '学習データはこの端末の中だけに保存され、外部には送信しません。' +
        '（画面の書体のみ Google Fonts から取得します）' +
      '</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" class="btn btn-ghost" id="export">書き出す</button>' +
        '<button type="button" class="btn btn-ghost" id="import">取り込む</button>' +
        '<button type="button" class="btn btn-ghost" id="reset">リセット</button>' +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="section-title">このアプリについて</div>' +
      '<p class="small muted">eikAIwa — 版 ' + EIK.VERSION + '</p>' +
      '<p class="small muted" style="margin-top:6px">オフラインで動作します。' +
        '<a href="#/install" style="color:var(--accent);font-weight:700">ホーム画面への追加方法</a></p>' +
    '</div>' +

  '</div>';

  /* ---- 配線 ---- */
  Array.prototype.forEach.call(app.querySelectorAll('[data-set]'), function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-set');
      var v = b.getAttribute('data-val');
      var num = parseFloat(v);
      EIK.Store.setSetting(k, isNaN(num) ? v : num);
      Array.prototype.forEach.call(app.querySelectorAll('[data-set="' + k + '"]'), function (o) {
        o.setAttribute('aria-pressed', o === b ? 'true' : 'false');
      });
      EIK.applyDisplaySettings();
    });
  });

  Array.prototype.forEach.call(app.querySelectorAll('[data-toggle]'), function (c) {
    c.addEventListener('change', function () {
      EIK.Store.setSetting(c.getAttribute('data-toggle'), c.checked);
    });
  });

  Array.prototype.forEach.call(app.querySelectorAll('[data-select]'), function (s) {
    s.addEventListener('change', function () {
      EIK.Store.setSetting(s.getAttribute('data-select'), s.value);
      if (s.getAttribute('data-select') === 'ttsVoice' && s.value) {
        EIK.TTS.speak('This is how it sounds.');
      }
    });
  });

  app.querySelector('#export').addEventListener('click', function () {
    var text = EIK.Store.exportJson();
    // 配信元がダウンロードを塞ぐ環境でも取り出せるよう、本文をそのまま見せる
    EIK.UI.dialog({
      title: '学習データの書き出し',
      message: '下のテキストをすべてコピーして保存してください。',
      prompt: true, value: text,
      buttons: [{ label: '閉じる', value: null, variant: 'ghost' }]
    });
  });

  app.querySelector('#import').addEventListener('click', function () {
    EIK.UI.prompt('書き出したテキストを貼り付けてください。現在のデータは置き換わります。',
                  { title: '学習データの取り込み', placeholder: '{ … }' })
      .then(function (v) {
        if (v == null || !String(v).trim()) return;
        try {
          EIK.Store.importJson(v);
          EIK.applyDisplaySettings();
          EIK.UI.toast('取り込みました');
          location.hash = '#/';
        } catch (e) {
          EIK.UI.alert('取り込めませんでした。\n' + (e.message || e), 'エラー');
        }
      });
  });

  app.querySelector('#reset').addEventListener('click', function () {
    EIK.UI.confirm('学習履歴・保存・設定をすべて消します。元に戻せません。',
                   { title: 'リセット', okText: '消す' })
      .then(function (ok) {
        if (!ok) return;
        EIK.Store.reset();
        EIK.applyDisplaySettings();
        EIK.UI.toast('リセットしました');
        location.hash = '#/';
      });
  });
};
