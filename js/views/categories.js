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
        '<span class="catcard__ic">' + EIK.icon(c.icon) + '</span>' +
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
      EIK.UI.levelPicker(level) +
      '<div class="section-title">カテゴリ（' + cats.length + '）</div>' +
      '<div class="catlist">' + rows + '</div></div>';

    EIK.UI.wireLevelPicker(app);
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

    var rows = list.map(function (x) { return EIK.UI.sitRow(x); }).join('');

    app.innerHTML = '<div class="stack-lg fade-in">' +
      EIK.UI.levelPicker(level) +
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
          (planned ? '<br>' + EIK.num(planned) + '問を予定しています。' : '') +
          '<br>上の段階を切り替えるとほかの難易度を練習できます。</div>') +
      '</div>' +
      '<a class="btn btn-ghost btn-block" href="#/categories">カテゴリ一覧へ戻る</a>' +
    '</div>';

    EIK.UI.wireLevelPicker(app);
  });
};
