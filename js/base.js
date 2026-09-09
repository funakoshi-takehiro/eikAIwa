/* ── 基盤ユーティリティ ────────────────────────────────────────────────────
   ビルド工程が無いため、すべて同一グローバルスコープ。読み込み順に依存する。
   （index.html の <script> の並び＝依存の浅い順）
   ────────────────────────────────────────────────────────────────────────── */
'use strict';

window.EIK = window.EIK || {};

EIK.VERSION = '2026090907';

/* サイトのベースパスを実行時に解決する。
   ビルドが無いので base を埋め込めない。GitHub Pages のプロジェクトページ
   (/eikAIwa/)、独自ドメイン (/)、ローカル (任意) のどれでも動くようにする。
   社内の既存プロダクトの siteBase() と同じ考え方。 */
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

/* 保存データ由来の数値は、表示する前に必ずここを通す。
   設定＞取り込む は任意の JSON を受け取るため、streak や progress.lv に
   文字列が入りうる。素通しすると innerHTML と属性に流れ込む
   （実際に持続型 XSS が成立した）。数値でなければ既定値に落とす。 */
EIK.num = function (v, fallback) {
  var n = typeof v === 'number' ? v : parseInt(v, 10);
  return isFinite(n) ? n : (fallback || 0);
};

EIK.el = function (tag, cls, html) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
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

/* インライン SVG のアイコン。
   以前は practice / categories / home / bookmarks の4箇所が、それぞれ
   同じ <svg> ラッパーを書いていた。しかも icPin と map、icStar と保存画面の星は
   パスまで完全に同じものが二重に存在していた。ここ1箇所に集める。

   寸法は当てていない。CSS の svg{width:1em;height:1em} が効く前提
   （CLAUDE.md 5節 — 個別に寸法を持たせたいときは呼び出し側で包む）。 */
EIK.ICONS = {
  // 画面部品
  pin:     '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>',
  eye:     '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:  '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.3 4"/><path d="M6.3 7.6A16.6 16.6 0 0 0 2.5 12S6 18 12 18a9.5 9.5 0 0 0 3.5-.66"/>',
  speaker: '<path d="M11 5 6.5 9H3v6h3.5L11 19z"/><path d="M15.6 8.4a5 5 0 0 1 0 7.2"/><path d="M18.4 5.6a9 9 0 0 1 0 12.8"/>',
  check:   '<circle cx="12" cy="12" r="9"/><path d="M8.2 12.4l2.6 2.6 5-5.4"/>',
  grid:    '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  /* カテゴリ。data/categories.json の icon がこの名前を指す。
     EIK.icon(c.icon) と動的に引くので、ソースを文字列検索しても
     使用箇所が出てこない。未使用と誤解して消さないこと。 */
  plane:  '<path d="M10.2 4.2a1.6 1.6 0 0 1 3 0l.5 5 6.3 3.4a1 1 0 0 1 .5.9v1.2l-7-1.6-.6 4 2.3 1.7v1.4l-3.5-.9-3.5.9v-1.4l2.3-1.7-.6-4-7 1.6v-1.2a1 1 0 0 1 .5-.9l6.3-3.4z"/>',
  train:  '<rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14"/><path d="M8.5 20l-2 2M15.5 20l2 2"/><circle cx="9" cy="13" r=".6"/><circle cx="15" cy="13" r=".6"/>',
  bed:    '<path d="M3 18V7"/><path d="M3 12h18v6"/><path d="M21 18v-4"/><circle cx="7.5" cy="9.5" r="2"/>',
  food:   '<path d="M6 3v8a2.5 2.5 0 0 0 5 0V3"/><path d="M8.5 11v10"/><path d="M17 3c-1.5 1.5-2 3.5-2 5.5S15.5 12 17 12v9"/>',
  bag:    '<path d="M4 8h16l-1.2 12H5.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  health: '<path d="M12 20.5S4 15.6 4 10.2A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 8 2.2c0 5.4-8 10.3-8 10.3z"/>',
  office: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
  call:   '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  school: '<path d="M12 4 2.5 9 12 14l9.5-5z"/><path d="M6 11.2V16c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-4.8"/>',
  chat:   '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-2.7-.4L3 21l1.6-4.6A8.2 8.2 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>',
  life:   '<path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/>',
  alert:  '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4"/><path d="M12 17h.01"/>'
};
EIK.ICONS.map = EIK.ICONS.pin;   // 道案内カテゴリ。同じ絵なので実体を共有する

/* 知らない名前は chat に落とす（categories.json 側が先行して新しい icon 名を
   持っていても、アイコンが消えて枠だけ残る事故にならないように）。 */
EIK.icon = function (name, strokeWidth) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
    (strokeWidth || 1.7) + '" stroke-linecap="round" stroke-linejoin="round">' +
    (EIK.ICONS[name] || EIK.ICONS.chat) + '</svg>';
};

/* 段階の表示。定義そのもの（文数の範囲など）は data/categories.json 側にあり、
   ここはアプリ内で軽く使う分の写しに留める。 */
EIK.levelStars = function (level) {
  return ({ 1: '★', 2: '★★', 3: '★★★' })[level] || '★';
};

/* 状況 id から段階を読む。
   id の形: transport-001（★） / transport-2-001（★★） / transport-3-001（★★★）
   ブックマークやカテゴリ一覧から1問だけ開くとき、
   設定中の段階と違っていても正しいファイルを読むために使う。 */
EIK.levelFromId = function (id) {
  var m = /-([23])-\d+$/.exec(String(id || ''));
  return m ? parseInt(m[1], 10) : 1;
};

EIK.REGISTER_LABEL = {
  casual: 'カジュアル',
  neutral: 'ふつう',
  polite: 'ていねい',
  formal: 'フォーマル'
};
