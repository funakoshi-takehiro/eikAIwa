/* ── 設定の保存 (localStorage) ─────────────────────────────────────────────
   保存しているのは**表示と練習の設定だけ**。学習履歴は持たない。

   なぜ履歴を持たないか:
   ログイン機能が無いので、置ける場所が localStorage しかない。localStorage は
   「その端末のそのブラウザ」の引き出しでしかなく、
     ・スマホと PC で別物。同じ端末でも Safari と Chrome で別物
     ・プライベートウィンドウは閉じたら消える
     ・「閲覧データを削除」で消える
     ・iOS はしばらく開かないと Safari が勝手に捨てることがある
   この上に「連続日数」や「復習の期限」を載せると、端末を変えた瞬間に
   ゼロに戻る。維持できないものを維持しているように見せることになるので、
   持たないことにした。出題は毎回ランダム。

   設定だけは残す。テーマや文字サイズを毎回選び直すのは煩わしく、
   消えても学習の記録を失うわけではないため。
   ────────────────────────────────────────────────────────────────────────── */
'use strict';

EIK.Store = (function () {
  var KEY = 'eikAIwa.v2';        // v1 は学習履歴を持っていた。形が違うので別キーにする

  var DEFAULTS = {
    showJa: false,        // 状況カードの和訳を既定で表示するか
    countdown: 10,        // 考える時間（秒）。0 で OFF
    showMyAnswer: true,   // 自分の答えの入力欄を出すか
    ttsRate: 0.95,
    ttsVoice: '',         // voiceURI
    theme: 'auto',        // auto | light | dark
    textSize: 'm',        // s | m | l | xl
    lineHeight: 'm',      // s | m | l
    level: 1              // 練習する段階 ★=1 / ★★=2 / ★★★=3
  };

  /* 値が取りうる範囲。ここを外れたものは既定値に落とす。
     theme / textSize / lineHeight は <html> の属性になり、
     level は読み込むファイル名の一部になるため、素通しできない。
     （履歴を持っていた頃、型を見ずに属性へ流して持続型 XSS が成立した） */
  var ENUMS = {
    theme: ['auto', 'light', 'dark'],
    textSize: ['s', 'm', 'l', 'xl'],
    lineHeight: ['s', 'm', 'l'],
    level: [1, 2, 3]
  };

  var state = null;

  function num(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
  function clamp(v, lo, hi, d) { return Math.max(lo, Math.min(hi, num(v, d))); }

  /* localStorage は同一オリジンの別のコードからも書ける。
     読んだものはそのまま信じず、必ずここで形を整えてから中へ入れる。 */
  function sanitize(obj) {
    var s = JSON.parse(JSON.stringify(DEFAULTS));
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return s;

    Object.keys(DEFAULTS).forEach(function (k) {
      if (!(k in obj)) return;
      var v = obj[k], d = DEFAULTS[k];
      if (ENUMS[k]) { if (ENUMS[k].indexOf(v) >= 0) s[k] = v; }
      else if (typeof d === 'boolean') { if (typeof v === 'boolean') s[k] = v; }
      else if (typeof d === 'number') { s[k] = num(v, d); }
      else if (typeof v === 'string') { s[k] = v; }
    });

    s.countdown = clamp(s.countdown, 0, 600, 10);
    s.ttsRate = clamp(s.ttsRate, 0.1, 2, 0.95);
    s.ttsVoice = String(s.ttsVoice || '').slice(0, 200);
    return s;
  }

  function load() {
    if (state) return state;
    state = sanitize(null);
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) state = sanitize(JSON.parse(raw));
    } catch (e) {
      // 壊れていても既定値で起動する（学習を止めない）
      console.warn('設定を読めませんでした。既定値で起動します。', e);
    }
    return state;
  }

  function write() {
    try {
      localStorage.setItem(KEY, JSON.stringify(load()));
    } catch (e) {
      // 保存できなくてもこの回の学習は続けられる
      console.warn('設定を保存できませんでした', e);
    }
  }

  function settings() { return load(); }

  function setSetting(k, v) {
    if (!(k in DEFAULTS)) return;
    load()[k] = v;
    state = sanitize(state);   // 入れた直後に丸める。呼び出し側の取りこぼしを通さない
    write();
  }

  function reset() {
    state = sanitize(null);
    try { localStorage.removeItem(KEY); } catch (e) { /* noop */ }
  }

  /* 別のタブで設定を変えたら、こちらにも反映する */
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    state = null;
    if (EIK.applyDisplaySettings) EIK.applyDisplaySettings();
  });

  return { settings: settings, setSetting: setSetting, reset: reset };
})();
