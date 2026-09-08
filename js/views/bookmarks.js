/* ── 保存（ブックマーク） ─────────────────────────────────────────────── */
'use strict';
EIK.Views = EIK.Views || {};

EIK.Views.Bookmarks = function (ctx) {
  var app = ctx.app;
  app.innerHTML = '<div class="loading">読み込み中…</div>';

  // 保存は段階をまたぐので、3段階すべて読んでから解決する
  Promise.all([EIK.Data.load(1), EIK.Data.load(2), EIK.Data.load(3)])
    .then(function (lists) {
      var all = lists[0].concat(lists[1], lists[2]);
      return all;
    }).then(function (all) {
    var raw = EIK.Store.raw();
    var sits = all.filter(function (s) { return raw.bookmarks.indexOf(s.id) >= 0; });

    // 個別に保存した言い方
    var marks = [];
    raw.answerMarks.forEach(function (k) {
      var p = k.split('#');
      var s = EIK.Data.get(p[0]);
      var idx = parseInt(p[1], 10);
      if (s && s.answers[idx]) marks.push({ s: s, idx: idx, a: s.answers[idx] });
    });

    if (!sits.length && !marks.length) {
      app.innerHTML = '<div class="card empty fade-in">' +
        '<div class="empty__ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z"/></svg></div>' +
        '<p style="font-weight:700;color:var(--ink-2)">まだ保存がありません</p>' +
        '<p class="small" style="margin-top:8px">練習中に ☆ を押すと、状況や言い方をここに保存できます。</p>' +
        '</div>';
      return;
    }

    var html = '<div class="stack-lg fade-in">';

    if (sits.length) {
      html += '<div>' +
        '<div class="section-title">保存した状況（' + sits.length + '）</div>' +
        '<div class="sitlist">' + sits.map(function (x) {
          var p = EIK.Store.progressOf(x.id);
          return '<a class="card sitrow" href="#/practice/one/' + encodeURIComponent(x.id) + '">' +
            '<span class="sitrow__box" data-lv="' + (p.lv || 0) + '" aria-hidden="true"></span>' +
            '<span class="sitrow__body">' +
              '<span class="sitrow__want">' + EIK.escapeHtml(x.want) + '</span>' +
              '<span class="sitrow__place">' + EIK.escapeHtml(x.place) + '　' +
                EIK.escapeHtml(EIK.levelStars(x.level || 1)) + '</span>' +
            '</span></a>';
        }).join('') + '</div>' +
        '<a class="btn btn-primary btn-block" style="margin-top:12px" href="#/practice/bookmarks">' +
          '保存した状況を練習する</a>' +
      '</div>';
    }

    if (marks.length) {
      html += '<div><div class="section-title">保存した言い方（' + marks.length + '）</div>' +
        '<div class="ans">' + marks.map(function (m) {
          return '<div class="ans__item">' +
            '<div class="ans__head"><div class="ans__en">' + EIK.escapeHtml(m.a.en) + '</div>' +
            '<div class="ans__tools">' +
              (EIK.TTS.usable() ? '<button type="button" class="iconbtn" data-say="' + EIK.escapeHtml(m.a.en) + '" aria-label="読み上げる">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M11 5 6.5 9H3v6h3.5L11 19z"/><path d="M15.6 8.4a5 5 0 0 1 0 7.2"/></svg></button>' : '') +
            '</div></div>' +
            '<div class="ans__ja">' + EIK.escapeHtml(m.a.ja) + '</div>' +
            '<div class="ans__meta"><span class="reg reg--' + EIK.escapeHtml(m.a.register) + '">' +
              EIK.escapeHtml(EIK.REGISTER_LABEL[m.a.register] || m.a.register) + '</span>' +
              '<span class="ans__note">' + EIK.escapeHtml(m.s.place) + '</span></div>' +
          '</div>';
        }).join('') + '</div></div>';
    }

    html += '</div>';
    app.innerHTML = html;

    Array.prototype.forEach.call(app.querySelectorAll('[data-say]'), function (b) {
      b.addEventListener('click', function () { EIK.TTS.speak(b.getAttribute('data-say')); });
    });
  });
};
