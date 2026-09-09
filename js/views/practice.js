/* ── 練習画面（コアループ） ────────────────────────────────────────────────
   1問の流れ:
     ① 状況を読む（英文・和訳は既定で伏せる）
     ② 口に出して言ってみる（任意のカウントダウン / 任意のメモ入力）
     ③ 10通りの言い方を開いて比べる
     ④ 次へ

   自己評価（✓ / △ / ✗）は外した。受け取る先だった復習アルゴリズムを
   やめたため、押しても何も起きないボタンになっていた。
   出題順は毎回シャッフルする。
   ────────────────────────────────────────────────────────────────────────── */
'use strict';

EIK.Views = EIK.Views || {};

EIK.Views.Practice = function (ctx) {
  var app = ctx.app;
  var mode = ctx.params.mode || 'random';
  var arg = ctx.params.arg || '';

  app.innerHTML = '<div class="loading">問題を準備しています…</div>';

  // 1問だけ開くときは、その問題が属する段階を id から判断する。
  // カテゴリ一覧から直接開いたとき、設定中の段階と違っても正しく開くため。
  var wantLevel = (mode === 'one') ? EIK.levelFromId(arg) : (EIK.Store.settings().level || 1);

  EIK.Data.load(wantLevel).then(function (all) {
    var st = EIK.Store.settings();
    var queue = buildQueue(mode, arg, all);

    if (!queue.length) {
      app.innerHTML =
        '<div class="card empty">' +
          '<div class="empty__ic">' + EIK.icon('check') + '</div>' +
          '<p style="font-weight:700;color:var(--ink-2)">出題できる問題がありません。</p>' +
          '<a class="btn btn-ghost" style="margin-top:18px" href="#/">ホームへ戻る</a>' +
        '</div>';
      return;
    }

    var i = 0;
    renderQuestion();

    function renderQuestion() {
      if (i >= queue.length) return renderDone();
      var s = queue[i];

      app.innerHTML =
        '<div class="pr fade-in">' +
          topBar(i + 1) +
          sitCard(s, st.showJa) +
          thinkBlock(st, s) +
        '</div>';

      wireJaToggle();

      var timerEl = app.querySelector('#timer');
      var stopTimer = startCountdown(timerEl, st.countdown);

      app.querySelector('#reveal').addEventListener('click', function () {
        stopTimer();
        var memo = app.querySelector('#myans');
        renderAnswers(s, memo ? memo.value : '');
      });
    }

    function renderAnswers(s, memo) {
      var last = (i + 1 >= queue.length);
      app.innerHTML =
        '<div class="pr fade-in">' +
          topBar(i + 1) +
          sitCard(s, st.showJa) +
          (memo && memo.trim()
            ? '<div class="card"><div class="section-title">あなたの答え</div>' +
              '<div style="font-size:.95rem;white-space:pre-wrap">' + EIK.escapeHtml(memo) + '</div></div>'
            : '') +
          '<div>' +
            '<div class="section-title">こう言えます（' + s.answers.length + '通り）</div>' +
            answerList(s) +
          '</div>' +
          '<button type="button" class="btn btn-primary btn-lg btn-block" id="next">' +
            (last ? '終わる' : '次の問題へ') +
          '</button>' +
        '</div>';

      wireJaToggle();
      EIK.UI.wireSpeak(app);

      app.querySelector('#next').addEventListener('click', function () {
        EIK.TTS.stop();
        i++;
        window.scrollTo({ top: 0, behavior: 'auto' });
        renderQuestion();
      });
    }

    /* 「もう一度」はリンクではなくボタンにしてある。理由が2つある。
       ・遷移先がいまのハッシュと同値になるため、リンクでは hashchange が
         発火せず、押しても何も起きなかった。
       ・href に mode / arg を連結していたが、これらはハッシュ由来で
         任意の文字列を取りうる。属性を抜けてイベントハンドラを注入できた。
       ボタンにすると、どちらも構造的に起きない。 */
    function renderDone() {
      app.innerHTML =
        '<div class="card done fade-in">' +
          '<div class="done__ic">' + EIK.icon('check') + '</div>' +
          '<h2 style="font-size:1.15rem;font-weight:700">おつかれさまでした</h2>' +
          '<p class="muted small" style="margin-top:8px">' +
            EIK.num(queue.length) + ' 問を練習しました。</p>' +
          '<div style="display:flex;gap:8px;margin-top:20px">' +
            '<a class="btn btn-ghost btn-block" href="#/">ホーム</a>' +
            '<button type="button" class="btn btn-primary btn-block" id="again">もう一度</button>' +
          '</div>' +
        '</div>';

      app.querySelector('#again').addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'auto' });
        EIK.Views.Practice(ctx);   // 同じ条件で組み直す（並びは引き直される）
      });
    }
  }).catch(function (e) {
    app.innerHTML = '<div class="card empty">問題データを読み込めませんでした。<br>' +
                    EIK.escapeHtml(e.message || e) + '</div>';
  });

  /* ---------- 出題キューの組み立て ----------
     並びは毎回引き直す。seed を渡さないので、開くたびに違う順序になる。 */
  function buildQueue(mode, arg, all) {
    if (mode === 'category') {
      return EIK.shuffle(all.filter(function (s) { return s.category === arg; }));
    }
    if (mode === 'one') {
      return all.filter(function (s) { return s.id === arg; });
    }
    return EIK.shuffle(all);
  }

  /* ---------- 部品 ---------- */
  function topBar(n) {
    return '<div class="pr__top">' +
             '<span class="pr__count">' + EIK.num(n) + ' 問目</span>' +
             '<a class="btn btn-ghost btn-sm" href="#/">やめる</a>' +
           '</div>';
  }

  function sitCard(s, showJa) {
    var jaBlock = showJa
      ? '<div class="sit__ja">' + EIK.escapeHtml(s.situationJa || '') + '</div>'
      : '<button type="button" class="sit__jatoggle" id="jatoggle">' + EIK.icon('eye') + ' 日本語で見る</button>' +
        '<div class="sit__ja" id="jabox" hidden>' + EIK.escapeHtml(s.situationJa || '') + '</div>';

    return '<div class="card sit">' +
             '<div class="sit__head">' +
               '<div class="sit__place">' + EIK.icon('pin') + ' ' + EIK.escapeHtml(s.place) + '</div>' +
               '<span class="lvbadge lvbadge--' + EIK.num(s.level, 1) + '">' +
                 EIK.escapeHtml(EIK.levelStars(s.level || 1)) + '</span>' +
             '</div>' +
             '<div class="sit__want">' + EIK.escapeHtml(s.want) + '</div>' +
             '<div class="sit__listener">相手: <b>' + EIK.escapeHtml(s.listener) + '</b></div>' +
             jaBlock +
           '</div>';
  }

  function thinkBlock(st, sit) {
    var timer = st.countdown > 0
      ? '<div class="think__timer" id="timer">' + EIK.num(st.countdown) + '</div>'
      : '<div class="think__timer is-done" id="timer" aria-hidden="true">—</div>';
    var lv = EIK.Data.levelMeta(sit.level || 1);
    var target = lv && lv.sentences
      ? '<p class="think__target">目安: <b>' + EIK.escapeHtml(lv.sentences) + '</b></p>'
      : '';
    return '<div class="card think">' +
             '<p class="think__hint">この状況で、あなたなら何と言いますか。<br><b>声に出して</b>言ってみてください。</p>' +
             target +
             timer +
           '</div>' +
           (st.showMyAnswer
             ? '<textarea class="myans" id="myans" placeholder="（任意）思いついた言い方をメモできます"></textarea>'
             : '') +
           '<button type="button" class="btn btn-primary btn-lg btn-block" id="reveal">言い方を見る</button>';
  }

  function answerList(s) {
    return '<div class="ans">' + s.answers.map(function (a) {
      return EIK.UI.answerItem(a, { note: a.note });
    }).join('') + '</div>';
  }

  /* ---------- 配線 ---------- */
  function startCountdown(el, seconds) {
    if (!el || !seconds || seconds <= 0) return function () {};
    var left = seconds;
    el.textContent = left;
    var t = setInterval(function () {
      left--;
      if (left <= 0) {
        clearInterval(t);
        el.textContent = '0';
        el.classList.add('is-done');
      } else {
        el.textContent = left;
      }
    }, 1000);
    return function () { clearInterval(t); };
  }

  function wireJaToggle() {
    var btn = app.querySelector('#jatoggle');
    var box = app.querySelector('#jabox');
    if (!btn || !box) return;
    btn.addEventListener('click', function () {
      var shown = !box.hidden;
      box.hidden = shown;
      btn.innerHTML = (shown ? EIK.icon('eye') + ' 日本語で見る' : EIK.icon('eyeOff') + ' 日本語を隠す');
    });
  }
};
