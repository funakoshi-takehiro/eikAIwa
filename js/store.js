/* ── 保存領域 (localStorage) ───────────────────────────────────────────────
   学習履歴・設定・ブックマークを保持する。ここから外部への送信は一切しない。
   容量は数百 KB 程度に収まる見込み（300問 × 小さなレコード）。
   ────────────────────────────────────────────────────────────────────────── */
'use strict';

EIK.Store = (function () {
  var KEY = 'eikAIwa.v1';

  var DEFAULTS = {
    settings: {
      showJa: false,        // 状況カードの和訳を既定で表示するか
      countdown: 10,        // 考える時間（秒）。0 で OFF
      showMyAnswer: true,   // 自分の答えの入力欄を出すか
      ttsRate: 0.95,
      ttsVoice: '',         // voiceURI
      theme: 'auto',        // auto | light | dark
      textSize: 'm',        // s | m | l | xl
      lineHeight: 'm',      // s | m | l
      dailyGoal: 10,
      level: 1              // 練習する段階 ★=1 / ★★=2 / ★★★=3
    },
    /* progress[situationId] = { lv:0..5, due:'YYYY-MM-DD', seen:n, got:n, last:'YYYY-MM-DD' } */
    progress: {},
    /* bookmarks: 状況IDの配列 / answerMarks: "sitId#idx" の配列 */
    bookmarks: [],
    answerMarks: [],
    /* 日次の記録 days['YYYY-MM-DD'] = 回答数 */
    days: {},
    streak: 0,
    lastDay: ''
  };

  /* 値が取りうる範囲。ここを外れたものは既定値に落とす。
     theme / textSize / lineHeight は <html> の属性になり、
     level は読み込むファイル名の一部になるため、素通しできない。 */
  var ENUMS = {
    theme: ['auto', 'light', 'dark'],
    textSize: ['s', 'm', 'l', 'xl'],
    lineHeight: ['s', 'm', 'l'],
    level: [1, 2, 3]
  };
  var YMD = /^\d{4}-\d{2}-\d{2}$/;

  var state = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isObj(o) { return o && typeof o === 'object' && !Array.isArray(o); }
  function n(v, d) { var x = Number(v); return isFinite(x) ? x : d; }

  /* 保存データは「外から来たもの」として扱う。
     設定＞取り込む は任意の JSON を受け取れるし、localStorage は
     同一オリジンの別のコードからも書ける。実際、型を見ていなかったため
     streak や progress.lv に文字列を入れて持続型 XSS が成立した。
     ここで形を整えてから、はじめてアプリの中へ入れる。 */
  function sanitize(obj) {
    var s = clone(DEFAULTS);
    if (!isObj(obj)) return s;

    if (isObj(obj.settings)) {
      Object.keys(DEFAULTS.settings).forEach(function (k) {
        if (!(k in obj.settings)) return;
        var v = obj.settings[k], d = DEFAULTS.settings[k];
        if (ENUMS[k]) { if (ENUMS[k].indexOf(v) >= 0) s.settings[k] = v; }
        else if (typeof d === 'boolean') { if (typeof v === 'boolean') s.settings[k] = v; }
        else if (typeof d === 'number') { s.settings[k] = n(v, d); }
        else if (typeof v === 'string') { s.settings[k] = v; }
      });
      s.settings.countdown = Math.max(0, Math.min(600, n(s.settings.countdown, 10)));
      s.settings.dailyGoal = Math.max(1, Math.min(300, n(s.settings.dailyGoal, 10)));
      s.settings.ttsRate = Math.max(0.1, Math.min(2, n(s.settings.ttsRate, 0.95)));
      s.settings.ttsVoice = String(s.settings.ttsVoice || '').slice(0, 200);
    }

    if (isObj(obj.progress)) {
      Object.keys(obj.progress).forEach(function (id) {
        var p = obj.progress[id];
        if (!isObj(p)) return;
        s.progress[String(id)] = {
          lv: Math.max(0, Math.min(5, n(p.lv, 0))),
          due: YMD.test(p.due) ? p.due : '',
          seen: Math.max(0, n(p.seen, 0)),
          got: Math.max(0, n(p.got, 0)),
          last: YMD.test(p.last) ? p.last : ''
        };
      });
    }

    ['bookmarks', 'answerMarks'].forEach(function (k) {
      if (!Array.isArray(obj[k])) return;
      s[k] = obj[k].filter(function (v) { return typeof v === 'string'; })
                   .map(function (v) { return v.slice(0, 200); });
    });

    if (isObj(obj.days)) {
      Object.keys(obj.days).forEach(function (d) {
        if (YMD.test(d)) s.days[d] = Math.max(0, n(obj.days[d], 0));
      });
    }

    s.streak = Math.max(0, n(obj.streak, 0));
    s.lastDay = YMD.test(obj.lastDay) ? obj.lastDay : '';
    return s;
  }

  function load() {
    if (state) return state;
    state = clone(DEFAULTS);
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) state = sanitize(JSON.parse(raw));
    } catch (e) {
      // 壊れていても既定値で起動する（学習を止めない）
      console.warn('保存データを読めませんでした。既定値で起動します。', e);
    }
    return state;
  }

  /* 保存の直前に、いま localStorage にあるものと突き合わせる。
     以前は state 全体をそのまま書き戻していたため、2つのタブで開くと
     後から保存した側が相手の学習記録を丸ごと消していた。 */
  function mergeStored(mine) {
    var stored;
    try { stored = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return mine; }
    if (!isObj(stored)) return mine;
    var theirs = sanitize(stored);
    var out = mine;

    Object.keys(theirs.progress).forEach(function (id) {
      var a = out.progress[id], b = theirs.progress[id];
      // 同じ問題は「最後に触った日」が新しい方を残す
      if (!a || String(b.last) > String(a.last)) out.progress[id] = b;
    });
    Object.keys(theirs.days).forEach(function (d) {
      // 同じ日は多い方を採る。書き込みのたびに突き合わせるので、
      // 取りこぼすのは相手が直前に増やした分だけに収まる。
      out.days[d] = Math.max(n(out.days[d], 0), theirs.days[d]);
    });
    ['bookmarks', 'answerMarks'].forEach(function (k) {
      theirs[k].forEach(function (v) { if (out[k].indexOf(v) < 0) out[k].push(v); });
    });
    if (String(theirs.lastDay) > String(out.lastDay)) {
      out.lastDay = theirs.lastDay;
      out.streak = theirs.streak;
    }
    // settings はこのタブの操作を優先する（利用者がいま変えたもの）
    return out;
  }

  var saveTimer = null;

  /* いまの state をそのまま書く。突き合わせをしない経路。
     取り込みとリセットは「置き換え」が目的なので、こちらを使う。 */
  function writeNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (!state) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('保存に失敗しました（容量超過の可能性）', e);
      if (EIK.UI) EIK.UI.toast('保存できませんでした。ブラウザの空き容量をご確認ください。');
    }
  }

  /* 通常の保存。他のタブの記録を消さないよう、書く前に突き合わせる。 */
  function flush() {
    if (!state) return;
    state = mergeStored(state);
    writeNow();
  }

  function save() {
    load();
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 120);
  }

  /* 離脱・バックグラウンド化で必ず書き切る。
     まとめ書き(120ms)の途中でタブが閉じたり SW でリロードされると、
     直前の1問が消える。pagehide は iOS Safari でも確実に発火する。 */
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });

  /* 他のタブが保存したら、こちらの手元にも取り込む。
     置き換えではなく突き合わせなので、このタブの未保存分は消えない。 */
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY || !state) return;
    state = mergeStored(state);
  });

  function settings() { return load().settings; }

  function setSetting(k, v) {
    load().settings[k] = v;
    save();
  }

  function progressOf(id) {
    var p = load().progress[id];
    return p || { lv: 0, due: '', seen: 0, got: 0, last: '' };
  }

  function setProgress(id, p) {
    load().progress[id] = p;
    save();
  }

  function recordAnswer() {
    var s = load();
    var t = EIK.today();
    s.days[t] = (s.days[t] || 0) + 1;
    if (s.lastDay !== t) {
      var y = EIK.addDays(t, -1);
      s.streak = (s.lastDay === y) ? (s.streak || 0) + 1 : 1;
      s.lastDay = t;
    }
    save();
  }

  function todayCount() { return load().days[EIK.today()] || 0; }

  function streak() {
    var s = load();
    if (!s.lastDay) return 0;
    var t = EIK.today();
    if (s.lastDay === t || s.lastDay === EIK.addDays(t, -1)) return s.streak || 0;
    return 0;   // 途切れている
  }

  /* bookmarks（状況）と answerMarks（言い方）は、どちらも文字列の集合で
     出し入れの仕方が同じ。別々に書くと片方だけ直して食い違う。 */
  function has(listName, key) { return load()[listName].indexOf(key) >= 0; }

  function toggleIn(listName, key) {
    var list = load()[listName];
    var i = list.indexOf(key);
    if (i >= 0) list.splice(i, 1); else list.push(key);
    save();
    return i < 0;                       // true = 追加した
  }

  function answerKey(sitId, idx) { return sitId + '#' + idx; }

  function isBookmarked(id) { return has('bookmarks', id); }
  function toggleBookmark(id) { return toggleIn('bookmarks', id); }
  function isAnswerMarked(sitId, idx) { return has('answerMarks', answerKey(sitId, idx)); }
  function toggleAnswerMark(sitId, idx) { return toggleIn('answerMarks', answerKey(sitId, idx)); }

  function exportJson() { return JSON.stringify(load(), null, 2); }

  /* 取り込みは、このアプリで最も「外から来たもの」が入る場所。
     形の検査は sanitize に一本化してある（load と同じ道を通す）。 */
  function importJson(text) {
    var obj = JSON.parse(text);
    if (!isObj(obj)) throw new Error('形式が正しくありません');
    state = sanitize(obj);
    writeNow();   // 取り込みは置き換え。突き合わせると元のデータが戻ってしまう
  }

  function reset() {
    state = clone(DEFAULTS);
    try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
    writeNow();   // リセットも置き換え
  }

  function raw() { return load(); }

  return {
    settings: settings, setSetting: setSetting,
    progressOf: progressOf, setProgress: setProgress,
    recordAnswer: recordAnswer, todayCount: todayCount, streak: streak,
    isBookmarked: isBookmarked, toggleBookmark: toggleBookmark,
    isAnswerMarked: isAnswerMarked, toggleAnswerMark: toggleAnswerMark,
    answerKey: answerKey,
    exportJson: exportJson, importJson: importJson, reset: reset, raw: raw,
    flush: flush
  };
})();
