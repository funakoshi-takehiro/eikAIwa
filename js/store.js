/* ── 保存領域 (localStorage) ───────────────────────────────────────────────
   学習履歴・設定・ブックマークを保持する。外部通信は一切しない。
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

  var state = null;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    if (state) return state;
    state = clone(DEFAULTS);
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        // 浅いマージ。settings だけは既定値で埋めてから上書きする
        Object.keys(DEFAULTS).forEach(function (k) {
          if (saved[k] == null) return;
          if (k === 'settings') {
            Object.keys(saved.settings || {}).forEach(function (sk) {
              if (sk in DEFAULTS.settings) state.settings[sk] = saved.settings[sk];
            });
          } else {
            state[k] = saved[k];
          }
        });
      }
    } catch (e) {
      // 壊れていても既定値で起動する（学習を止めない）
      console.warn('保存データを読めませんでした。既定値で起動します。', e);
    }
    return state;
  }

  var saveTimer = null;

  function flush() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (!state) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('保存に失敗しました（容量超過の可能性）', e);
      if (EIK.UI) EIK.UI.toast('保存できませんでした。ブラウザの空き容量をご確認ください。');
    }
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

  function isBookmarked(id) { return load().bookmarks.indexOf(id) >= 0; }

  function toggleBookmark(id) {
    var b = load().bookmarks;
    var i = b.indexOf(id);
    if (i >= 0) b.splice(i, 1); else b.push(id);
    save();
    return i < 0;
  }

  function answerKey(sitId, idx) { return sitId + '#' + idx; }
  function isAnswerMarked(sitId, idx) { return load().answerMarks.indexOf(answerKey(sitId, idx)) >= 0; }
  function toggleAnswerMark(sitId, idx) {
    var a = load().answerMarks;
    var k = answerKey(sitId, idx);
    var i = a.indexOf(k);
    if (i >= 0) a.splice(i, 1); else a.push(k);
    save();
    return i < 0;
  }

  function exportJson() { return JSON.stringify(load(), null, 2); }

  function importJson(text) {
    var obj = JSON.parse(text);
    if (!obj || typeof obj !== 'object') throw new Error('形式が正しくありません');
    state = clone(DEFAULTS);
    Object.keys(DEFAULTS).forEach(function (k) {
      if (obj[k] != null) state[k] = obj[k];
    });
    // settings は既定値で穴埋め
    var s = clone(DEFAULTS.settings);
    Object.keys(obj.settings || {}).forEach(function (sk) {
      if (sk in s) s[sk] = obj.settings[sk];
    });
    state.settings = s;
    save();
  }

  function reset() {
    state = clone(DEFAULTS);
    try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
    save();
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
