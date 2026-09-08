/* ── 復習アルゴリズム (Leitner box の簡易版) ───────────────────────────────
   lv 0..5。✓ で1段上げ、△ は据え置き、✗ で1段目に戻す。
   再出題間隔: lv1=1日, lv2=2日, lv3=4日, lv4=7日, lv5=14日。
   SM-2 のような複雑さは要らない — 目的は「忘れた頃にまた出す」ことだけ。
   ────────────────────────────────────────────────────────────────────────── */
'use strict';

EIK.SRS = (function () {
  var INTERVALS = [0, 1, 2, 4, 7, 14];   // index = lv

  function apply(p, judge) {
    var lv = p.lv || 0;
    if (judge === 'got')        lv = Math.min(5, lv + 1);
    else if (judge === 'close') lv = Math.max(1, lv);
    else                        lv = 1;   // miss は 1 に戻す（0 は「未学習」用に空けておく）

    var t = EIK.today();
    return {
      lv: lv,
      due: EIK.addDays(t, INTERVALS[lv]),
      seen: (p.seen || 0) + 1,
      got: (p.got || 0) + (judge === 'got' ? 1 : 0),
      last: t
    };
  }

  function isDue(p, todayYmd) {
    if (!p || !p.lv) return true;                 // 未学習は常に対象
    if (!p.due) return true;
    return EIK.dayNumber(p.due) <= EIK.dayNumber(todayYmd || EIK.today());
  }

  /* 今日の出題を選ぶ。
     優先順: ①期限が来た既習（期限が古い順） → ②未学習（カテゴリを散らす） */
  function pickDaily(situations, limit) {
    var t = EIK.today();
    var due = [];
    var fresh = [];

    situations.forEach(function (s) {
      var p = EIK.Store.progressOf(s.id);
      if (!p.lv) fresh.push(s);
      else if (isDue(p, t)) due.push({ s: s, due: p.due });
    });

    due.sort(function (a, b) { return EIK.dayNumber(a.due) - EIK.dayNumber(b.due); });
    var out = due.map(function (x) { return x.s; });

    if (out.length < limit) {
      // 同じ日は同じ並びになるように、日付をシードにする
      var seed = EIK.hashStr(t);
      var picked = EIK.shuffle(fresh, seed);
      // カテゴリが固まらないよう、カテゴリ単位でラウンドロビンする
      var byCat = {};
      picked.forEach(function (s) { (byCat[s.category] = byCat[s.category] || []).push(s); });
      var cats = Object.keys(byCat);
      var i = 0;
      while (out.length < limit && cats.length) {
        var c = cats[i % cats.length];
        var arr = byCat[c];
        if (arr && arr.length) out.push(arr.shift());
        if (!arr || !arr.length) { cats.splice(cats.indexOf(c), 1); i--; }
        i++;
      }
    }
    return out.slice(0, limit);
  }

  function stats(situations) {
    var learned = 0, mastered = 0, dueNow = 0;
    var t = EIK.today();
    situations.forEach(function (s) {
      var p = EIK.Store.progressOf(s.id);
      if (p.lv) {
        learned++;
        if (p.lv >= 5) mastered++;
        if (isDue(p, t)) dueNow++;
      }
    });
    return { total: situations.length, learned: learned, mastered: mastered, due: dueNow };
  }

  return { apply: apply, isDue: isDue, pickDaily: pickDaily, stats: stats, INTERVALS: INTERVALS };
})();
