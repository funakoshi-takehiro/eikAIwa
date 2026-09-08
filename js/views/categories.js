/* ── カテゴリ一覧 / カテゴリ詳細 ──────────────────────────────────────── */
'use strict';
EIK.Views = EIK.Views || {};

EIK.Views.Categories = function (ctx) {
  var app = ctx.app;
  app.innerHTML = '<div class="loading">読み込み中…</div>';

  var level = EIK.Store.settings().level || 1;

  EIK.Data.load(level).then(function () {
    var cats = EIK.Data.allCategories();
    var rows = cats.map(function (c) {
      var list = EIK.Data.inCategory(c.id, level);
      var planned = EIK.Data.plannedCount(c.id, level);
      var s = EIK.SRS.stats(list);
      var pct = s.total ? s.learned / s.total : 0;
      var meta = list.length
        ? s.learned + ' / ' + s.total + ' 問' + (s.due ? '　・　復習 ' + s.due + '件' : '')
        : (planned ? '準備中（' + planned + '問を予定）' : '準備中');

      return '<a class="card catcard' + (list.length ? '' : ' is-pending') + '" ' +
          'href="#/categories/' + encodeURIComponent(c.id) + '">' +
        '<span class="catcard__ic">' + iconFor(c.icon) + '</span>' +
        '<span class="catcard__body">' +
          '<span class="catcard__name">' + EIK.escapeHtml(c.nameJa) + '</span>' +
          '<span class="catcard__meta">' + EIK.escapeHtml(meta) + '</span>' +
        '</span>' +
        (list.length
          ? '<span class="catcard__ring">' + EIK.ringSvg(pct, 38, 3) +
            '<span class="catcard__pct">' + Math.round(pct * 100) + '</span></span>'
          : '') +
      '</a>';
    }).join('');

    app.innerHTML = '<div class="stack fade-in">' +
      EIK.levelPickerHtml(level) +
      '<div class="section-title">カテゴリ（' + cats.length + '）</div>' +
      '<div class="catlist">' + rows + '</div></div>';

    EIK.wireLevelPicker(app);
  }).catch(function (e) {
    app.innerHTML = '<div class="card empty">' + EIK.escapeHtml(e.message || e) + '</div>';
  });
};

EIK.Views.Category = function (ctx) {
  var app = ctx.app;
  var id = ctx.params.id;
  app.innerHTML = '<div class="loading">読み込み中…</div>';

  var level = EIK.Store.settings().level || 1;

  EIK.Data.load(level).then(function () {
    var c = EIK.Data.categoryMeta(id);
    if (!c) {
      app.innerHTML = '<div class="card empty">カテゴリが見つかりません。</div>';
      return;
    }
    var list = EIK.Data.inCategory(id, level);
    var planned = EIK.Data.plannedCount(id, level);
    var s = EIK.SRS.stats(list);

    var rows = list.map(function (x) {
      var p = EIK.Store.progressOf(x.id);
      return '<a class="card sitrow" href="#/practice/one/' + encodeURIComponent(x.id) + '">' +
        '<span class="sitrow__box" data-lv="' + (p.lv || 0) + '" aria-hidden="true"></span>' +
        '<span class="sitrow__body">' +
          '<span class="sitrow__want">' + EIK.escapeHtml(x.want) + '</span>' +
          '<span class="sitrow__place">' + EIK.escapeHtml(x.place) + '</span>' +
        '</span>' +
      '</a>';
    }).join('');

    app.innerHTML = '<div class="stack-lg fade-in">' +
      EIK.levelPickerHtml(level) +
      '<div class="card">' +
        '<div class="eyebrow">' + EIK.escapeHtml(c.nameEn || '') + '</div>' +
        '<h2 style="font-size:1.15rem;font-weight:700;margin-top:6px">' + EIK.escapeHtml(c.nameJa) + '</h2>' +
        '<p class="small muted" style="margin-top:6px">' + EIK.escapeHtml(c.descJa || '') + '</p>' +
        (list.length
          ? '<div style="margin-top:14px"><div class="pbar"><div class="pbar__fill" style="width:' +
              (s.total ? s.learned / s.total * 100 : 0) + '%"></div></div></div>' +
            '<p class="small muted" style="margin-top:8px">' + s.learned + ' / ' + s.total + ' 問を学習ずみ</p>'
          : '') +
      '</div>' +
      (list.length
        ? '<a class="btn btn-primary btn-lg btn-block" href="#/practice/category/' + encodeURIComponent(id) + '">' +
            'このカテゴリを練習する</a>'
        : '') +
      '<div><div class="section-title">状況一覧（' + list.length + '）</div>' +
      (list.length
        ? '<div class="sitlist">' + rows + '</div>'
        : '<div class="card empty">' + EIK.escapeHtml(EIK.levelStars(level)) +
          ' のこのカテゴリはまだ準備中です。' +
          (planned ? '<br>' + planned + '問を予定しています。' : '') +
          '<br>上の段階を切り替えるとほかの難易度を練習できます。</div>') +
      '</div>' +
      '<a class="btn btn-ghost btn-block" href="#/categories">カテゴリ一覧へ戻る</a>' +
    '</div>';

    EIK.wireLevelPicker(app);
  });
};

function iconFor(name) {
  var P = {
    plane:  '<path d="M10.2 4.2a1.6 1.6 0 0 1 3 0l.5 5 6.3 3.4a1 1 0 0 1 .5.9v1.2l-7-1.6-.6 4 2.3 1.7v1.4l-3.5-.9-3.5.9v-1.4l2.3-1.7-.6-4-7 1.6v-1.2a1 1 0 0 1 .5-.9l6.3-3.4z"/>',
    train:  '<rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14"/><path d="M8.5 20l-2 2M15.5 20l2 2"/><circle cx="9" cy="13" r=".6"/><circle cx="15" cy="13" r=".6"/>',
    bed:    '<path d="M3 18V7"/><path d="M3 12h18v6"/><path d="M21 18v-4"/><circle cx="7.5" cy="9.5" r="2"/>',
    food:   '<path d="M6 3v8a2.5 2.5 0 0 0 5 0V3"/><path d="M8.5 11v10"/><path d="M17 3c-1.5 1.5-2 3.5-2 5.5S15.5 12 17 12v9"/>',
    bag:    '<path d="M4 8h16l-1.2 12H5.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    map:    '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>',
    health: '<path d="M12 20.5S4 15.6 4 10.2A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 8 2.2c0 5.4-8 10.3-8 10.3z"/>',
    office: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
    call:   '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
    school: '<path d="M12 4 2.5 9 12 14l9.5-5z"/><path d="M6 11.2V16c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-4.8"/>',
    chat:   '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-2.7-.4L3 21l1.6-4.6A8.2 8.2 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>',
    life:   '<path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/>',
    alert:  '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4"/><path d="M12 17h.01"/>'
  };
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
         'stroke-linecap="round" stroke-linejoin="round">' + (P[name] || P.chat) + '</svg>';
}
