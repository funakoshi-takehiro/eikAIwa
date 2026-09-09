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
