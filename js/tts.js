/* ── 読み上げ (Web Speech API) ─────────────────────────────────────────────
   音声ファイルを同梱しないので容量が増えない。OS 内蔵音声なのでオフラインでも動く。

   端末差の注意:
   - iOS Safari は「ユーザー操作起因」でないと発話しない。必ずタップから呼ぶこと。
   - getVoices() は非同期に埋まる端末がある（voiceschanged を待つ）。
   - 音声が1つも無い環境では 🔊 ボタン自体を出さない（レイアウトを崩さないため）。
   ────────────────────────────────────────────────────────────────────────── */
'use strict';

EIK.TTS = (function () {
  var supported = typeof window.speechSynthesis !== 'undefined' &&
                  typeof window.SpeechSynthesisUtterance !== 'undefined';
  var voices = [];
  var ready = false;

  function refresh() {
    if (!supported) return;
    try {
      voices = window.speechSynthesis.getVoices() || [];
    } catch (e) { voices = []; }
    if (voices.length) ready = true;
  }

  if (supported) {
    refresh();
    try {
      window.speechSynthesis.addEventListener('voiceschanged', refresh);
    } catch (e) {
      window.speechSynthesis.onvoiceschanged = refresh;
    }
  }

  function englishVoices() {
    return voices.filter(function (v) { return /^en(-|_|$)/i.test(v.lang || ''); });
  }

  /* 使える見込みがあるか。voices がまだ空でも supported なら true を返す
     （iOS は最初の発話までリストが埋まらないことがあるため、
       ここで false にすると永久にボタンが出なくなる）。 */
  function usable() { return supported; }

  function pickVoice() {
    var want = EIK.Store.settings().ttsVoice;
    if (want) {
      for (var i = 0; i < voices.length; i++) {
        if (voices[i].voiceURI === want) return voices[i];
      }
    }
    var en = englishVoices();
    if (!en.length) return null;
    // en-US を優先し、次に既定音声
    for (var j = 0; j < en.length; j++) if (/^en-US/i.test(en[j].lang)) return en[j];
    for (var k = 0; k < en.length; k++) if (en[k].default) return en[k];
    return en[0];
  }

  function speak(text) {
    if (!supported || !text) return false;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(text));
      var v = pickVoice();
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = 'en-US'; }
      var r = parseFloat(EIK.Store.settings().ttsRate);
      u.rate = isNaN(r) ? 0.95 : Math.max(0.5, Math.min(1.5, r));
      u.pitch = 1;
      window.speechSynthesis.speak(u);
      if (!ready) refresh();
      return true;
    } catch (e) {
      console.warn('読み上げに失敗しました', e);
      return false;
    }
  }

  function stop() {
    if (!supported) return;
    try { window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
  }

  return {
    usable: usable, speak: speak, stop: stop,
    voices: function () { return englishVoices(); },
    refresh: refresh
  };
})();
