/* ── 基盤ユーティリティ ────────────────────────────────────────────────────
   ビルド工程が無いため、すべて同一グローバルスコープ。読み込み順に依存する。
   （index.html の <script> の並び＝依存の浅い順）
   ────────────────────────────────────────────────────────────────────────── */
'use strict';

window.EIK = window.EIK || {};

EIK.VERSION = '20260908c';

/* サイトのベースパスを実行時に解決する。
   ビルドが無いので base を埋め込めない。GitHub Pages のプロジェクトページ
   (/eng_std/)、独自ドメイン (/)、ローカル (任意) のどれでも動くようにする。
   PyHiroba の siteBase() と同じ考え方。 */
EIK.siteBase = (function () {
  var p = location.pathname;
  // 末尾のファイル名を落としてディレクトリ部分だけにする
  var dir = p.replace(/[^/]*$/, '');
  if (!dir.endsWith('/')) dir += '/';
  return dir;
})();

EIK.url = function (rel) {
  return EIK.siteBase + String(rel).replace(/^\//, '');
};

EIK.escapeHtml = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
};

EIK.el = function (tag, cls, html) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

/* 今日を YYYY-MM-DD で返す（ローカル時刻基準）。
   UTC にすると日本の夜が翌日扱いになり「連続日数」が壊れるので必ずローカル。 */
EIK.today = function (d) {
  d = d || new Date();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
};

EIK.dayNumber = function (ymd) {
  // YYYY-MM-DD → 経過日数（ローカル正午基準で DST の影響を避ける）
  var p = String(ymd).split('-');
  return Math.floor(new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0).getTime() / 86400000);
};

EIK.addDays = function (ymd, n) {
  var p = String(ymd).split('-');
  var d = new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0);
  d.setDate(d.getDate() + n);
  return EIK.today(d);
};

/* Fisher–Yates。seed を渡すと再現性のある並びになる（同日は同じ順序にしたい） */
EIK.shuffle = function (arr, seed) {
  var a = arr.slice();
  var rnd;
  if (seed == null) {
    rnd = Math.random;
  } else {
    var s = seed >>> 0;
    rnd = function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(rnd() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
};

EIK.hashStr = function (s) {
  var h = 2166136261 >>> 0;
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

/* 進捗リングの SVG。塗りつぶさず 1px ストロークの円にする（ブランドの流儀） */
EIK.ringSvg = function (pct, size, stroke) {
  size = size || 92;
  stroke = stroke || 4;
  var r = (size - stroke) / 2;
  var c = 2 * Math.PI * r;
  var off = c * (1 - Math.max(0, Math.min(1, pct)));
  return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
    '<circle class="ring__track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke-width="' + stroke + '"/>' +
    '<circle class="ring__value" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke-width="' + stroke + '" ' +
    'stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '" ' +
    'transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg>';
};

EIK.REGISTER_LABEL = {
  casual: 'カジュアル',
  neutral: 'ふつう',
  polite: 'ていねい',
  formal: 'フォーマル'
};
