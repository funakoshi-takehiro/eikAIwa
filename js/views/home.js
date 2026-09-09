/* ── ホーム ────────────────────────────────────────────────────────────────
   このアプリが何なのかを最初に言う場所。
   以前は「今日の目標」「連続日数」「習得ずみ」を並べていたが、
   その数字を支えていたのは localStorage だけで、端末を変えれば消えるものだった。
   維持できないものを維持しているように見せるのをやめ、
   代わりに「何をする道具か」を置いた。
   ────────────────────────────────────────────────────────────────────────── */
'use strict';
EIK.Views = EIK.Views || {};

EIK.Views.Home = function (ctx) {
  var app = ctx.app;
  app.innerHTML = '<div class="loading">読み込み中…</div>';

  var level = EIK.Store.settings().level || 1;

  EIK.Data.load(level).then(function (all) {
    app.innerHTML =
      '<div class="stack-lg fade-in">' +

        '<div class="card">' +
          '<div class="eyebrow">Speaking practice</div>' +
          '<h2 class="lead">英語を「知っている」から<br>「口から出る」へ。</h2>' +
          '<p class="small muted" style="margin-top:10px">' +
            '状況を英文で読み、<b>自分の言葉を考えて声に出し</b>、' +
            'そのあと10通りの言い方と突き合わせます。' +
            '先に答えを見ないことが要点です。' +
          '</p>' +
          '<ol class="steps">' +
            '<li><b>状況を読む</b><span>英文で。和訳は伏せてあります</span></li>' +
            '<li><b>声に出す</b><span>うまく言えなくてかまいません</span></li>' +
            '<li><b>10通りと比べる</b><span>ひとこと〜フォーマルまで、違いつき</span></li>' +
          '</ol>' +
        '</div>' +

        EIK.UI.levelPicker(level) +

        (all.length
          ? '<a class="btn btn-primary btn-lg btn-block" href="#/practice/random">' +
              '練習をはじめる</a>'
          : '<div class="card empty">' + EIK.escapeHtml(EIK.levelStars(level)) +
            ' の問題はまだ準備中です。<br>上の段階を切り替えてお使いください。</div>') +

        '<div class="catlist">' +
          '<a class="card catcard" href="#/categories">' +
            '<span class="catcard__ic">' + EIK.icon('grid') + '</span>' +
            '<span class="catcard__body">' +
              '<span class="catcard__name">カテゴリから選ぶ</span>' +
              '<span class="catcard__meta">場面をしぼって練習する</span>' +
            '</span>' +
          '</a>' +
        '</div>' +

        '<p class="small muted" style="text-align:center">' +
          '出題は毎回ランダムです。学習の記録は残しません。' +
        '</p>' +

      '</div>';

    EIK.UI.wireLevelPicker(app);
  }).catch(function (e) {
    app.innerHTML = '<div class="card empty">データを読み込めませんでした。<br>' +
                    EIK.escapeHtml(e.message || e) + '</div>';
  });
};
