/* ── 保存（ブックマーク） ─────────────────────────────────────────────── */
'use strict';
EIK.Views = EIK.Views || {};

EIK.Views.Bookmarks = function (ctx) {
  var app = ctx.app;
  app.innerHTML = '<div class="loading">読み込み中…</div>';

  // 保存は段階をまたぐので、3段階すべて読んでから解決する
  Promise.all([EIK.Data.load(1), EIK.Data.load(2), EIK.Data.load(3)]).then(function (lists) {
    var all = lists[0].concat(lists[1], lists[2]);
    var raw = EIK.Store.raw();
    var sits = all.filter(function (s) { return raw.bookmarks.indexOf(s.id) >= 0; });

    // 個別に保存した言い方
    var marks = [];
    raw.answerMarks.forEach(function (k) {
      var p = k.split('#');
      var s = EIK.Data.get(p[0]);
      var idx = parseInt(p[1], 10);
      if (s && s.answers[idx]) marks.push({ s: s, a: s.answers[idx] });
    });

    if (!sits.length && !marks.length) {
      app.innerHTML = '<div class="card empty fade-in">' +
        '<div class="empty__ic">' + EIK.icon('star', 1.5) + '</div>' +
        '<p style="font-weight:700;color:var(--ink-2)">まだ保存がありません</p>' +
        '<p class="small" style="margin-top:8px">練習中に ☆ を押すと、状況や言い方をここに保存できます。</p>' +
        '</div>';
      return;
    }

    var html = '<div class="stack-lg fade-in">';

    if (sits.length) {
      html += '<div>' +
        '<div class="section-title">保存した状況（' + sits.length + '）</div>' +
        '<div class="sitlist">' +
          sits.map(function (x) { return EIK.UI.sitRow(x, { showLevel: true }); }).join('') +
        '</div>' +
        '<a class="btn btn-primary btn-block" style="margin-top:12px" href="#/practice/bookmarks">' +
          '保存した状況を練習する</a>' +
      '</div>';
    }

    if (marks.length) {
      html += '<div>' +
        '<div class="section-title">保存した言い方（' + marks.length + '）</div>' +
        '<div class="ans">' +
          marks.map(function (m) { return EIK.UI.answerItem(m.a, { note: m.s.place }); }).join('') +
        '</div>' +
      '</div>';
    }

    app.innerHTML = html + '</div>';
    EIK.UI.wireSpeak(app);
  }).catch(function (e) {
    app.innerHTML = '<div class="card empty">' + EIK.escapeHtml(e.message || e) + '</div>';
  });
};
