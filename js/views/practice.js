/* ── 練習画面（コアループ） ────────────────────────────────────────────────
   1問の流れ:
     ① 状況を読む（英文・和訳は既定で伏せる）
     ② 口に出して言ってみる（任意のカウントダウン / 任意のメモ入力）
     ③ 10通りの言い方を開いて比べる
     ④ 自己評価 → Leitner box に反映
   ────────────────────────────────────────────────────────────────────────── */
'use strict';

EIK.Views = EIK.Views || {};

EIK.Views.Practice = function (ctx) {
  var app = ctx.app;
  var mode = ctx.params.mode || 'daily';
  var arg = ctx.params.arg || '';

  app.innerHTML = '<div class="loading">問題を準備しています…</div>';

  var st0 = EIK.Store.settings();
  // 1問だけ開くときは、その問題が属する段階を id から判断する。
  // 設定中の段階と違ってもブックマークから直接開けるようにするため。
  var wantLevel = (mode === 'one') ? EIK.levelFromId(arg) : (st0.level || 1);

  EIK.Data.load(wantLevel).then(function (all) {
    var st = EIK.Store.settings();
    var queue = buildQueue(mode, arg, all, st);

    if (!queue.length) {
      app.innerHTML =
        '<div class="card empty">' +
          '<div class="empty__ic">' + EIK.icon('check') + '</div>' +
          '<p style="font-weight:700;color:var(--ink-2)">いまは出題できる問題がありません。</p>' +
          '<p class="small" style="margin-top:8px">復習の期限が来たものが無く、未学習も残っていません。</p>' +
          '<a class="btn btn-ghost" style="margin-top:18px" href="#/">ホームへ戻る</a>' +
        '</div>';
      return;
    }

    var i = 0;
    var answered = 0;
    renderQuestion();

    function renderQuestion() {
      if (i >= queue.length) return renderDone();
      var s = queue[i];

      app.innerHTML =
        '<div class="pr fade-in">' +
          topBar(i + 1, queue.length) +
          sitCard(s, st.showJa) +
          thinkBlock(st, s) +
        '</div>';

      wireJaToggle();
      wireBookmark(s);

      var revealBtn = app.querySelector('#reveal');
      var timerEl = app.querySelector('#timer');
      var stopTimer = startCountdown(timerEl, st.countdown);

      revealBtn.addEventListener('click', function () {
        stopTimer();
        var memo = app.querySelector('#myans');
        renderAnswers(s, memo ? memo.value : '');
      });
    }

    function renderAnswers(s, memo) {
      app.innerHTML =
        '<div class="pr fade-in">' +
          topBar(i + 1, queue.length) +
          sitCard(s, st.showJa) +
          (memo && memo.trim()
            ? '<div class="card"><div class="section-title">あなたの答え</div>' +
              '<div style="font-size:.95rem;white-space:pre-wrap">' + EIK.escapeHtml(memo) + '</div></div>'
            : '') +
          '<div>' +
            '<div class="section-title">こう言えます（' + s.answers.length + '通り）</div>' +
            answerList(s) +
          '</div>' +
          judgeBlock() +
        '</div>';

      wireJaToggle();
      wireBookmark(s);
      wireAnswerTools(s);

      Array.prototype.forEach.call(app.querySelectorAll('.judge__btn'), function (b) {
        b.addEventListener('click', function () {
          var j = b.getAttribute('data-j');
          var p = EIK.Store.progressOf(s.id);
          EIK.Store.setProgress(s.id, EIK.SRS.apply(p, j));
          EIK.Store.recordAnswer();
          answered++;
          EIK.TTS.stop();
          i++;
          window.scrollTo({ top: 0, behavior: 'auto' });
          renderQuestion();
        });
      });
    }

    /* 「もう一度」はリンクではなくボタンにしてある。理由が2つある。
       ・遷移先がいまのハッシュと同値になるため、リンクでは hashchange が
         発火せず、押しても何も起きなかった。
       ・href に mode / arg を連結していたが、これらはハッシュ由来で
         任意の文字列を取りうる。属性を抜けてイベントハンドラを注入できた。
       ボタンにすると、どちらも構造的に起きない。 */
    function renderDone() {
      var s = EIK.Store;
      app.innerHTML =
        '<div class="card done fade-in">' +
          '<div class="done__ic">' + EIK.icon('check') + '</div>' +
          '<h2 style="font-size:1.15rem;font-weight:700">おつかれさまでした</h2>' +
          '<p class="muted small" style="margin-top:8px">' + EIK.num(answered) + ' 問を練習しました。</p>' +
          '<div class="statrow" style="margin-top:20px">' +
            '<div class="stat"><div class="stat__v accent">' + EIK.num(s.todayCount()) + '</div><div class="stat__l">今日の合計</div></div>' +
            '<div class="stat"><div class="stat__v">' + EIK.num(s.streak()) + '</div><div class="stat__l">連続日数</div></div>' +
            '<div class="stat"><div class="stat__v">' + EIK.num(answered) + '</div><div class="stat__l">この回</div></div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;margin-top:20px">' +
            '<a class="btn btn-ghost btn-block" href="#/">ホーム</a>' +
            '<button type="button" class="btn btn-primary btn-block" id="again">もう一度</button>' +
          '</div>' +
        '</div>';

      var again = app.querySelector('#again');
      if (again) {
        again.addEventListener('click', function () {
          window.scrollTo({ top: 0, behavior: 'auto' });
          EIK.Views.Practice(ctx);   // 同じ条件で組み直す
        });
      }
    }
  }).catch(function (e) {
    app.innerHTML = '<div class="card empty">問題データを読み込めませんでした。<br>' +
                    EIK.escapeHtml(e.message || e) + '</div>';
  });

  /* ---------- 出題キューの組み立て ---------- */
  function buildQueue(mode, arg, all, st) {
    var limit = Math.max(1, EIK.num(st.dailyGoal, 10));
    if (mode === 'daily')    return EIK.SRS.pickDaily(all, limit);
    if (mode === 'category') {
      var list = all.filter(function (s) { return s.category === arg; });
      var due = list.filter(function (s) { return EIK.SRS.isDue(EIK.Store.progressOf(s.id)); });
      return EIK.shuffle(due.length ? due : list, EIK.hashStr(EIK.today() + arg)).slice(0, limit);
    }
    if (mode === 'bookmarks') {
      var ids = EIK.Store.raw().bookmarks;
      return all.filter(function (s) { return ids.indexOf(s.id) >= 0; });
    }
    if (mode === 'one') {
      return all.filter(function (s) { return s.id === arg; });
    }
    // shuffle
    return EIK.shuffle(all).slice(0, limit);
  }

  /* ---------- 部品 ---------- */
  function topBar(n, total) {
    var pct = Math.round((n - 1) / total * 100);
    return '<div class="pr__top">' +
             '<span class="pr__count">' + n + ' / ' + total + '</span>' +
             '<div class="pr__bar"><div class="pbar"><div class="pbar__fill" style="width:' + pct + '%"></div></div></div>' +
             '<button type="button" class="iconbtn" id="bm" aria-label="この状況を保存">' + EIK.icon('star') + '</button>' +
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
      ? '<div class="think__timer" id="timer">' + st.countdown + '</div>'
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
    return '<div class="ans">' + s.answers.map(function (a, idx) {
      return EIK.UI.answerItem(a, { mark: { id: s.id, idx: idx }, note: a.note });
    }).join('') + '</div>';
  }

  function judgeBlock() {
    return '<div>' +
      '<div class="section-title">言えましたか？</div>' +
      '<div class="judge">' +
        '<button type="button" class="judge__btn" data-j="got"><span class="judge__ic">' + EIK.icon('check') + '</span>言えた</button>' +
        '<button type="button" class="judge__btn" data-j="close"><span class="judge__ic">' + EIK.icon('near') + '</span>惜しい</button>' +
        '<button type="button" class="judge__btn" data-j="miss"><span class="judge__ic">' + EIK.icon('miss') + '</span>出てこなかった</button>' +
      '</div>' +
    '</div>';
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

  function wireBookmark(s) {
    var btn = app.querySelector('#bm');
    if (!btn) return;
    var set = function () {
      btn.setAttribute('aria-pressed', EIK.Store.isBookmarked(s.id) ? 'true' : 'false');
    };
    set();
    btn.addEventListener('click', function () {
      var on = EIK.Store.toggleBookmark(s.id);
      set();
      EIK.UI.toast(on ? 'この状況を保存しました' : '保存を解除しました');
    });
  }

  function wireAnswerTools(s) {
    EIK.UI.wireSpeak(app);
    Array.prototype.forEach.call(app.querySelectorAll('[data-mark]'), function (b) {
      b.addEventListener('click', function () {
        var idx = +b.getAttribute('data-mark');
        var on = EIK.Store.toggleAnswerMark(s.id, idx);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        EIK.UI.toast(on ? 'この言い方を保存しました' : '保存を解除しました');
      });
    });
  }
};
