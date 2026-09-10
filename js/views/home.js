/* ── ホーム ────────────────────────────────────────────────────────────────
   このアプリが何なのかを最初に言う場所。

   文章の作り方について。
   飾りの英語ラベル（Speaking practice のような見出し）、
   「AからBへ」の標語、3段の手順リストは書かない。
   どれも売り文句の型で、中身を読まなくても読み飛ばせてしまう。
   代わりに、実際に何が起きるかをそのまま順に書く。
   ダッシュ（波ダッシュを含む）も使わない。
   ────────────────────────────────────────────────────────────────────────── */
'use strict';
EIK.Views = EIK.Views || {};

EIK.Views.Home = function (ctx) {
  var app = ctx.app;
  app.innerHTML = '<div class="loading">読み込み中…</div>';

  var level = EIK.Store.settings().level || 1;

  EIK.Data.load(level).then(function (all) {
    var cats = EIK.Data.allCategories().length;

    app.innerHTML =
      '<div class="stack-lg fade-in">' +

        '<div class="card">' +
          '<h2 class="lead">声に出してから、<br>答えを見る。</h2>' +
          '<p class="small" style="margin-top:12px;color:var(--ink-3)">' +
            '英語で短い場面が出ます。たとえば「駅で、トイレの場所を聞きたい」。' +
            'まず自分の言葉で言ってみてください。うまく言えなくてかまいません。' +
          '</p>' +
          '<p class="small" style="margin-top:10px;color:var(--ink-3)">' +
            'そのあとで、同じ場面の言い方を10通り並べます。' +
            'ひとことで済ませる形から、かしこまった形まで。' +
            'どれをいつ使うかも書いてあります。' +
          '</p>' +
          '<p class="small muted" style="margin-top:14px">' +
            '先に答えを見ると、読んで分かった気になって終わります。' +
            '和訳を伏せてあるのも同じ理由です。' +
          '</p>' +
        '</div>' +

        EIK.UI.levelPicker(level) +

        (all.length
          ? '<a class="btn btn-primary btn-lg btn-block" href="#/practice/random">' +
              '練習をはじめる</a>'
          : '<div class="card empty">' + EIK.escapeHtml(EIK.levelStars(level)) +
            ' の問題はまだ用意できていません。<br>上の段階を切り替えてお使いください。</div>') +

        '<div class="catlist">' +
          '<a class="card catcard" href="#/categories">' +
            '<span class="catcard__ic">' + EIK.icon('grid') + '</span>' +
            '<span class="catcard__body">' +
              '<span class="catcard__name">場面をしぼって練習する</span>' +
              '<span class="catcard__meta">空港、病院、職場など' +
                EIK.num(cats, 13) + 'の場面から選べます</span>' +
            '</span>' +
          '</a>' +
        '</div>' +

        '<p class="small muted" style="text-align:center">' +
          '問題は毎回ちがう順で出ます。学習の記録は残していません。' +
        '</p>' +

      '</div>';

    EIK.UI.wireLevelPicker(app);
  }).catch(function (e) {
    app.innerHTML = '<div class="card empty">データを読み込めませんでした。<br>' +
                    EIK.escapeHtml(e.message || e) + '</div>';
  });
};
