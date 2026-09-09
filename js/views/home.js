/* ── ホーム ────────────────────────────────────────────────────────────── */
'use strict';
EIK.Views = EIK.Views || {};

EIK.Views.Home = function (ctx) {
  var app = ctx.app;
  app.innerHTML = '<div class="loading">読み込み中…</div>';

  var st = EIK.Store.settings();
  var level = st.level || 1;

  EIK.Data.load(level).then(function (all) {
    var lv = EIK.Data.levelMeta(level) || {};
    var s = EIK.SRS.stats(all);
    // 保存データ由来なので数値へ落としてから使う（取り込みで文字列が入りうる）
    var todayN = EIK.num(EIK.Store.todayCount());
    var goal = Math.max(1, EIK.num(st.dailyGoal, 10));
    var pct = Math.min(1, todayN / goal);
    var due = EIK.SRS.pickDaily(all, goal).length;

    app.innerHTML =
      '<div class="stack-lg fade-in">' +

        EIK.UI.levelPicker(level) +

        '<div class="card hero">' +
          '<div class="hero__ring">' +
            EIK.ringSvg(pct, 92, 5) +
            '<div class="hero__ringtext">' +
              '<div class="hero__num">' + todayN + '</div>' +
              '<div class="hero__den">/ ' + goal + ' 問</div>' +
            '</div>' +
          '</div>' +
          '<div class="hero__body">' +
            '<div class="hero__title">' + (todayN >= goal ? '今日の目標を達成しました' : '今日の練習') + '</div>' +
            '<div class="hero__sub">' +
              (todayN >= goal
                ? 'この調子で続けましょう。追加で練習もできます。'
                : 'あと ' + Math.max(0, goal - todayN) + ' 問で今日の目標です。') +
            '</div>' +
          '</div>' +
        '</div>' +

        (all.length
          ? '<a class="btn btn-primary btn-lg btn-block" href="#/practice/daily">' +
              (due > 0 ? '今日の練習をはじめる（' + due + '問）' : '練習をはじめる') +
            '</a>'
          : '<div class="card empty">' + EIK.escapeHtml(EIK.levelStars(level)) +
            ' の問題はまだ準備中です。<br>上の段階を切り替えてお使いください。</div>') +

        '<div class="statrow">' +
          '<div class="stat"><div class="stat__v accent">' + s.learned + '</div><div class="stat__l">学習した問題</div></div>' +
          '<div class="stat"><div class="stat__v">' + s.mastered + '</div><div class="stat__l">習得ずみ</div></div>' +
          '<div class="stat"><div class="stat__v">' + EIK.num(EIK.Store.streak()) + '</div><div class="stat__l">連続日数</div></div>' +
        '</div>' +

        '<div>' +
          '<div class="section-title">' + EIK.escapeHtml(EIK.levelStars(level)) + ' の進みぐあい</div>' +
          '<div class="card">' +
            '<div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:8px">' +
              '<span class="muted">全 ' + s.total + ' 問</span>' +
              '<span style="font-weight:700;color:var(--accent)">' +
                Math.round(s.learned / Math.max(1, s.total) * 100) + '%</span>' +
            '</div>' +
            '<div class="pbar"><div class="pbar__fill" style="width:' +
              (s.learned / Math.max(1, s.total) * 100) + '%"></div></div>' +
            '<p class="small muted" style="margin-top:12px">' +
              '復習の期限が来ているもの: <b style="color:var(--ink-2)">' + s.due + '</b> 件' +
            '</p>' +
          '</div>' +
        '</div>' +

        '<div>' +
          '<div class="section-title">ほかの練習</div>' +
          '<div class="catlist">' +
            '<a class="card catcard" href="#/categories">' +
              '<span class="catcard__ic">' + EIK.icon('grid') + '</span>' +
              '<span class="catcard__body"><span class="catcard__name">カテゴリから選ぶ</span>' +
              '<span class="catcard__meta">場面ごとに集中して練習する</span></span>' +
            '</a>' +
            '<a class="card catcard" href="#/practice/shuffle">' +
              '<span class="catcard__ic">' + EIK.icon('shuffle') + '</span>' +
              '<span class="catcard__body"><span class="catcard__name">シャッフル</span>' +
              '<span class="catcard__meta">全カテゴリからランダムに出題</span></span>' +
            '</a>' +
          '</div>' +
        '</div>' +

      '</div>';

    EIK.UI.wireLevelPicker(app);
  }).catch(function (e) {
    app.innerHTML = '<div class="card empty">データを読み込めませんでした。<br>' +
                    EIK.escapeHtml(e.message || e) + '</div>';
  });
};
