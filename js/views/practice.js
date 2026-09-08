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

  EIK.Data.loadAll().then(function (all) {
    var st = EIK.Store.settings();
    var queue = buildQueue(mode, arg, all, st);

    if (!queue.length) {
      app.innerHTML =
        '<div class="card empty">' +
          '<div class="empty__ic">' + icCheck() + '</div>' +
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
      var showJa = st.showJa;

      app.innerHTML =
        '<div class="pr fade-in">' +
          topBar(i + 1, queue.length) +
          sitCard(s, showJa) +
          thinkBlock(st) +
        '</div>';

      wireJaToggle(s);
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
          sitCard(s, st.showJa, true) +
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

      wireJaToggle(s);
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

    function renderDone() {
      var s = EIK.Store;
      app.innerHTML =
        '<div class="card done fade-in">' +
          '<div class="done__ic">' + icCheck() + '</div>' +
          '<h2 style="font-size:1.15rem;font-weight:700">おつかれさまでした</h2>' +
          '<p class="muted small" style="margin-top:8px">' + answered + ' 問を練習しました。</p>' +
          '<div class="statrow" style="margin-top:20px">' +
            '<div class="stat"><div class="stat__v accent">' + s.todayCount() + '</div><div class="stat__l">今日の合計</div></div>' +
            '<div class="stat"><div class="stat__v">' + s.streak() + '</div><div class="stat__l">連続日数</div></div>' +
            '<div class="stat"><div class="stat__v">' + answered + '</div><div class="stat__l">この回</div></div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;margin-top:20px">' +
            '<a class="btn btn-ghost btn-block" href="#/">ホーム</a>' +
            '<a class="btn btn-primary btn-block" href="#/practice/' + mode + (arg ? '/' + arg : '') + '">もう一度</a>' +
          '</div>' +
        '</div>';
    }
  }).catch(function (e) {
    app.innerHTML = '<div class="card empty">問題データを読み込めませんでした。<br>' +
                    EIK.escapeHtml(e.message || e) + '</div>';
  });

  /* ---------- 出題キューの組み立て ---------- */
  function buildQueue(mode, arg, all, st) {
    var limit = Math.max(1, parseInt(st.dailyGoal, 10) || 10);
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
      var one = all.filter(function (s) { return s.id === arg; });
      return one;
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
             '<button type="button" class="iconbtn" id="bm" aria-label="この状況を保存">' + icStar() + '</button>' +
           '</div>';
  }

  function sitCard(s, showJa, compact) {
    var jaBlock = showJa
      ? '<div class="sit__ja">' + EIK.escapeHtml(s.situationJa || '') + '</div>'
      : '<button type="button" class="sit__jatoggle" id="jatoggle">' + icEye() + ' 日本語で見る</button>' +
        '<div class="sit__ja" id="jabox" hidden>' + EIK.escapeHtml(s.situationJa || '') + '</div>';

    return '<div class="card sit">' +
             '<div class="sit__place">' + icPin() + ' ' + EIK.escapeHtml(s.place) + '</div>' +
             '<div class="sit__want">' + EIK.escapeHtml(s.want) + '</div>' +
             '<div class="sit__listener">相手: <b>' + EIK.escapeHtml(s.listener) + '</b></div>' +
             jaBlock +
           '</div>';
  }

  function thinkBlock(st) {
    var timer = st.countdown > 0
      ? '<div class="think__timer" id="timer">' + st.countdown + '</div>'
      : '<div class="think__timer is-done" id="timer" aria-hidden="true">—</div>';
    return '<div class="card think">' +
             '<p class="think__hint">この状況で、あなたなら何と言いますか。<br><b>声に出して</b>言ってみてください。</p>' +
             timer +
           '</div>' +
           (st.showMyAnswer
             ? '<textarea class="myans" id="myans" placeholder="（任意）思いついた言い方をメモできます"></textarea>'
             : '') +
           '<button type="button" class="btn btn-primary btn-lg btn-block" id="reveal">言い方を見る</button>';
  }

  function answerList(s) {
    var canTts = EIK.TTS.usable();
    var rows = s.answers.map(function (a, idx) {
      var marked = EIK.Store.isAnswerMarked(s.id, idx);
      return '<div class="ans__item">' +
        '<div class="ans__head">' +
          '<div class="ans__en">' + EIK.escapeHtml(a.en) + '</div>' +
          '<div class="ans__tools">' +
            (canTts ? '<button type="button" class="iconbtn" data-speak="' + idx + '" aria-label="読み上げる">' + icSpeaker() + '</button>' : '') +
            '<button type="button" class="iconbtn" data-mark="' + idx + '" aria-pressed="' + (marked ? 'true' : 'false') + '" aria-label="この言い方を保存">' + icStar() + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="ans__ja">' + EIK.escapeHtml(a.ja) + '</div>' +
        '<div class="ans__meta">' +
          '<span class="reg reg--' + EIK.escapeHtml(a.register) + '">' +
            EIK.escapeHtml(EIK.REGISTER_LABEL[a.register] || a.register) + '</span>' +
          (a.note ? '<span class="ans__note">' + EIK.escapeHtml(a.note) + '</span>' : '') +
        '</div>' +
      '</div>';
    }).join('');
    return '<div class="ans">' + rows + '</div>';
  }

  function judgeBlock() {
    return '<div>' +
      '<div class="section-title">言えましたか？</div>' +
      '<div class="judge">' +
        '<button type="button" class="judge__btn" data-j="got"><span class="judge__ic">' + icCheck() + '</span>言えた</button>' +
        '<button type="button" class="judge__btn" data-j="close"><span class="judge__ic">' + icNear() + '</span>惜しい</button>' +
        '<button type="button" class="judge__btn" data-j="miss"><span class="judge__ic">' + icMiss() + '</span>出てこなかった</button>' +
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

  function wireJaToggle(s) {
    var btn = app.querySelector('#jatoggle');
    var box = app.querySelector('#jabox');
    if (!btn || !box) return;
    btn.addEventListener('click', function () {
      var shown = !box.hidden;
      box.hidden = shown;
      btn.innerHTML = (shown ? icEye() + ' 日本語で見る' : icEyeOff() + ' 日本語を隠す');
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
    Array.prototype.forEach.call(app.querySelectorAll('[data-speak]'), function (b) {
      b.addEventListener('click', function () {
        var idx = +b.getAttribute('data-speak');
        // iOS はユーザー操作起因が必要なので、必ずこのハンドラの中から呼ぶ
        EIK.TTS.speak(s.answers[idx].en);
      });
    });
    Array.prototype.forEach.call(app.querySelectorAll('[data-mark]'), function (b) {
      b.addEventListener('click', function () {
        var idx = +b.getAttribute('data-mark');
        var on = EIK.Store.toggleAnswerMark(s.id, idx);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        EIK.UI.toast(on ? 'この言い方を保存しました' : '保存を解除しました');
      });
    });
  }

  /* ---------- アイコン（インライン SVG・stroke 1.7・currentColor） ---------- */
  function svg(inner, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
           'stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '>' + inner + '</svg>';
  }
  function icPin()   { return svg('<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>'); }
  function icStar()  { return svg('<path d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z"/>'); }
  function icEye()   { return svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'); }
  function icEyeOff(){ return svg('<path d="M3 3l18 18"/><path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.3 4"/><path d="M6.3 7.6A16.6 16.6 0 0 0 2.5 12S6 18 12 18a9.5 9.5 0 0 0 3.5-.66"/>'); }
  function icSpeaker(){ return svg('<path d="M11 5 6.5 9H3v6h3.5L11 19z"/><path d="M15.6 8.4a5 5 0 0 1 0 7.2"/><path d="M18.4 5.6a9 9 0 0 1 0 12.8"/>'); }
  function icCheck() { return svg('<circle cx="12" cy="12" r="9"/><path d="M8.2 12.4l2.6 2.6 5-5.4"/>'); }
  function icNear()  { return svg('<circle cx="12" cy="12" r="9"/><path d="M8 13.4c1.2-1.1 2.6-1.1 4 0s2.8 1.1 4 0"/><path d="M9 9.2h.01M15 9.2h.01"/>'); }
  function icMiss()  { return svg('<circle cx="12" cy="12" r="9"/><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6"/>'); }
};
