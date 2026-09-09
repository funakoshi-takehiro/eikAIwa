/* ── UI 部品 (トースト / モーダル) ─────────────────────────────────────────
   社内の既存プロダクトの UI 部品とモーダルを合わせたもの。
   モーダルはフォーカストラップ・Escape・フォーカス復帰まで面倒を見る。
   ────────────────────────────────────────────────────────────────────────── */
'use strict';

EIK.UI = (function () {
  var toastWrap = null;

  function toast(message, ms) {
    if (!toastWrap) {
      toastWrap = EIK.el('div', 'toastwrap');
      document.body.appendChild(toastWrap);
    }
    var t = EIK.el('div', 'toast');
    t.textContent = String(message);
    toastWrap.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 250);
    }, ms || 2600);
  }

  /* buttons: [{label, value, variant:'primary'|'ghost'}] */
  function dialog(opts) {
    return new Promise(function (resolve) {
      var prevFocus = document.activeElement;
      var ov = EIK.el('div', 'modal-ov');
      var m = EIK.el('div', 'modal');
      m.setAttribute('role', 'dialog');
      m.setAttribute('aria-modal', 'true');

      var title = EIK.el('div', 'modal__title');
      title.textContent = opts.title || '確認';
      var msg = EIK.el('div', 'modal__msg');
      msg.textContent = opts.message || '';
      var foot = EIK.el('div', 'modal__foot');

      m.appendChild(title);
      m.appendChild(msg);

      var input = null;
      if (opts.prompt) {
        input = EIK.el('textarea', 'myans');
        input.style.marginTop = '14px';
        input.value = opts.value || '';
        input.placeholder = opts.placeholder || '';
        m.appendChild(input);
      }
      m.appendChild(foot);
      ov.appendChild(m);

      var defs = opts.buttons || [{ label: 'OK', value: true, variant: 'primary' }];
      var btnEls = [];

      function close(v) {
        ov.classList.remove('is-open');
        document.removeEventListener('keydown', onKey, true);
        setTimeout(function () { ov.remove(); }, 200);
        if (prevFocus && typeof prevFocus.focus === 'function') {
          try { prevFocus.focus(); } catch (e) { /* 元要素が消えていても無視 */ }
        }
        resolve(v);
      }

      defs.forEach(function (d) {
        var b = EIK.el('button', 'btn ' + (d.variant === 'primary' ? 'btn-primary' : 'btn-ghost'));
        b.type = 'button';
        b.textContent = d.label;
        b.addEventListener('click', function () {
          close(opts.prompt && d.value === true ? (input ? input.value : '') : d.value);
        });
        foot.appendChild(b);
        btnEls.push(b);
      });

      // フォーカストラップ + Escape
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(opts.escapeValue === undefined ? null : opts.escapeValue); return; }
        if (e.key !== 'Tab') return;
        var focusables = btnEls.slice();
        if (input) focusables.unshift(input);
        if (!focusables.length) return;
        var first = focusables[0], last = focusables[focusables.length - 1];
        var a = document.activeElement;
        if (e.shiftKey) {
          if (a === first || !m.contains(a)) { e.preventDefault(); last.focus(); }
        } else {
          if (a === last || !m.contains(a)) { e.preventDefault(); first.focus(); }
        }
      }

      document.body.appendChild(ov);
      ov.addEventListener('mousedown', function (e) {
        if (e.target === ov) close(opts.escapeValue === undefined ? null : opts.escapeValue);
      });
      document.addEventListener('keydown', onKey, true);

      void ov.offsetWidth;            // 初期状態を確定させてからトランジション
      ov.classList.add('is-open');
      (input || btnEls[btnEls.length - 1] || m).focus();
    });
  }

  function alert(message, title) {
    return dialog({ title: title || 'お知らせ', message: message,
                    buttons: [{ label: 'OK', value: true, variant: 'primary' }] });
  }

  function confirm(message, opts) {
    opts = opts || {};
    return dialog({
      title: opts.title || '確認',
      message: message,
      escapeValue: false,
      buttons: [
        { label: opts.cancelText || 'キャンセル', value: false, variant: 'ghost' },
        { label: opts.okText || 'OK', value: true, variant: 'primary' }
      ]
    });
  }

  function prompt(message, opts) {
    opts = opts || {};
    return dialog({
      title: opts.title || '入力',
      message: message,
      prompt: true,
      value: opts.value || '',
      placeholder: opts.placeholder || '',
      escapeValue: null,
      buttons: [
        { label: 'キャンセル', value: null, variant: 'ghost' },
        { label: 'OK', value: true, variant: 'primary' }
      ]
    });
  }

  return { toast: toast, alert: alert, confirm: confirm, prompt: prompt, dialog: dialog };
})();

/* ── 画面をまたいで使う部品 ────────────────────────────────────────────────
   2つ以上の画面が同じ HTML を組み立てていたものを、ここに集めた。

   ここに置くのは views/*.js より先に読み込まれるため。
   以前は難易度スイッチが views/home.js にあり、categories.js が
   「home.js が先に読まれていること」に暗黙に依存していた。
   同一グローバルスコープ + 読み込み順依存の構成では、この種の依存が
   いちばん追いにくい。
   ────────────────────────────────────────────────────────────────────────── */

/* 難易度の切り替え。ホームとカテゴリ一覧の両方から使う。 */
EIK.UI.levelPicker = function (current) {
  var levels = EIK.Data.allLevels();
  if (!levels.length) {
    levels = [{ level: 1, stars: '★' }, { level: 2, stars: '★★' }, { level: 3, stars: '★★★' }];
  }
  var meta = null;
  var btns = levels.map(function (l) {
    if (l.level === current) meta = l;
    return '<button type="button" class="lv__btn" data-level="' + EIK.num(l.level, 1) + '" ' +
           'aria-pressed="' + (l.level === current ? 'true' : 'false') + '">' +
           EIK.escapeHtml(l.stars) + '</button>';
  }).join('');
  return '<div class="lv">' +
    '<div class="lv__row">' +
      '<span class="lv__label">難易度</span>' +
      '<div class="lv__seg" role="group" aria-label="難易度">' + btns + '</div>' +
    '</div>' +
    (meta && meta.sentences
      ? '<div class="lv__desc"><b>' + EIK.escapeHtml(meta.sentences) + 'で答える</b>' +
        ' — ' + EIK.escapeHtml(meta.descJa || '') + '</div>'
      : '') +
  '</div>';
};

EIK.UI.wireLevelPicker = function (root) {
  Array.prototype.forEach.call(root.querySelectorAll('.lv__btn'), function (b) {
    b.addEventListener('click', function () {
      var lv = parseInt(b.getAttribute('data-level'), 10);
      if (lv === (EIK.Store.settings().level || 1)) return;
      EIK.Store.setSetting('level', lv);   // setSetting が即書きするので flush は不要
      EIK.Router.render();
    });
  });
};

/* 状況1件の行。カテゴリ詳細で使う。
   以前は左端に習熟度の四角を出していたが、進捗を持たなくなったので外した。 */
EIK.UI.sitRow = function (sit) {
  return '<a class="card sitrow" href="#/practice/one/' + encodeURIComponent(sit.id) + '">' +
    '<span class="sitrow__body">' +
      '<span class="sitrow__want">' + EIK.escapeHtml(sit.want) + '</span>' +
      '<span class="sitrow__place">' + EIK.escapeHtml(sit.place) + '</span>' +
    '</span>' +
  '</a>';
};

/* 読み上げボタン。使えない端末では何も出さない
   （空の枠だけ残るとレイアウトが崩れるため）。
   読ませる文は属性に入れる。押した瞬間に元データを引き直す必要がなく、
   画面ごとに違う配線を書かずに済む。 */
EIK.UI.speakButton = function (text) {
  if (!EIK.TTS.usable()) return '';
  return '<button type="button" class="iconbtn" data-say="' + EIK.escapeHtml(text) +
         '" aria-label="読み上げる">' + EIK.icon('speaker') + '</button>';
};

EIK.UI.wireSpeak = function (root) {
  Array.prototype.forEach.call(root.querySelectorAll('[data-say]'), function (b) {
    // iOS はユーザー操作起因でないと発話しない。必ずこのハンドラの中から呼ぶ
    b.addEventListener('click', function () { EIK.TTS.speak(b.getAttribute('data-say')); });
  });
};

/* 解答1件。opts.note で丁寧さラベルの隣に一言を添える。 */
EIK.UI.answerItem = function (a, opts) {
  opts = opts || {};
  var tools = EIK.UI.speakButton(a.en);
  return '<div class="ans__item">' +
    '<div class="ans__head">' +
      '<div class="ans__en">' + EIK.escapeHtml(a.en) + '</div>' +
      '<div class="ans__tools">' + tools + '</div>' +
    '</div>' +
    '<div class="ans__ja">' + EIK.escapeHtml(a.ja) + '</div>' +
    '<div class="ans__meta">' +
      '<span class="reg reg--' + EIK.escapeHtml(a.register) + '">' +
        EIK.escapeHtml(EIK.REGISTER_LABEL[a.register] || a.register) + '</span>' +
      (opts.note ? '<span class="ans__note">' + EIK.escapeHtml(opts.note) + '</span>' : '') +
    '</div>' +
  '</div>';
};
