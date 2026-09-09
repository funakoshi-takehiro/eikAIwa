/*
 * ブラウザ実機に近い形での通し確認（Playwright / Chromium）
 *
 * ねらい: ビルド工程が無く、JS は同一グローバルスコープで読み込み順に依存する。
 *         「構文は通るが実行時に白画面」を CI とローカルの両方で捕まえる。
 *
 * GitHub Pages のプロジェクトページと同じサブパス配信 (/eikAIwa/) で開き、
 * ホーム → 練習 → 解答表示 → 自己評価 → カテゴリ → 保存 → 設定 を実際に操作する。
 * コンソールエラーとページ内エラーは1件でも出たら失敗にする。
 *
 * 使い方:
 *   python3 -m http.server 8080 -d /home/user &
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/browser_smoke.js
 */
'use strict';

const { chromium } = require('playwright');

const BASE = process.env.SMOKE_URL || 'http://localhost:8080/eikAIwa/';
const SHOT_DIR = process.env.SMOKE_SHOTS || '';

const problems = [];
const steps = [];

function step(name, ok, detail) {
  steps.push({ name, ok, detail });
  console.log(`  ${ok ? 'ok ' : 'NG '} ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) problems.push(name + (detail ? ': ' + detail : ''));
}

(async () => {
  const browser = await chromium.launch();
  // iPhone 相当の画面で見る（本アプリはスマホが主戦場）
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ja-JP',
  });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  async function shot(name) {
    if (!SHOT_DIR) return;
    // 入場アニメーション(0.4s)が終わってから撮る。途中で撮ると薄く写る。
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: false });
  }

  try {
    // ---------- ホーム ----------
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('.hero', { timeout: 10000 });
    step('ホームが描画される', true);

    const title = await page.title();
    step('title が設定されている', /eikAIwa/.test(title), title);

    const startBtn = page.locator('a[href="#/practice/daily"]').first();
    step('「練習をはじめる」がある', (await startBtn.count()) > 0);

    // 初回訪問で「新しい版が公開されています」バーが出てはいけない
    await page.waitForTimeout(1800);
    step('初回訪問で更新バーが出ない',
      await page.locator('#update-bar').isHidden());
    await shot('01-home');

    // ---------- 練習: 状況カード ----------
    await startBtn.click();
    await page.waitForSelector('.sit__want', { timeout: 10000 });
    const want = (await page.locator('.sit__want').first().innerText()).trim();
    step('状況カードが出る', want.length > 0, want.slice(0, 48));
    step('WANT が You want で始まる', /^You want/.test(want));

    const jaHidden = await page.locator('#jabox').isHidden().catch(() => null);
    step('和訳が既定で伏せられている', jaHidden === true);

    // 和訳トグル
    await page.locator('#jatoggle').click();
    await page.waitForTimeout(120);
    step('タップで和訳が開く', await page.locator('#jabox').isVisible());
    await shot('02-situation');

    // ---------- 練習: 解答 ----------
    await page.locator('#reveal').click();
    await page.waitForSelector('.ans__item', { timeout: 10000 });
    const n = await page.locator('.ans__item').count();
    step('解答が10件表示される', n === 10, `${n} 件`);

    const badges = await page.locator('.reg').count();
    step('丁寧さバッジが各解答に付く', badges === 10, `${badges} 個`);

    const regClasses = await page.$$eval('.reg', (els) =>
      Array.from(new Set(els.map((e) => e.className.replace('reg reg--', '')))));
    step('丁寧さが3種類以上に散っている', regClasses.length >= 3, regClasses.join(', '));
    await shot('03-answers');

    // ---------- 自己評価 ----------
    step('自己評価ボタンが3つ', (await page.locator('.judge__btn').count()) === 3);
    await page.locator('.judge__btn[data-j="got"]').click();
    await page.waitForSelector('.sit__want', { timeout: 10000 });
    step('次の問題へ進む', true);

    // localStorage に記録されたか（まとめ書きの 120ms を待つ）
    await page.waitForTimeout(400);
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('eikAIwa.v1');
      if (!raw) return null;
      const o = JSON.parse(raw);
      return { progress: Object.keys(o.progress || {}).length, days: o.days };
    });
    step('学習履歴が localStorage に残る',
      saved && saved.progress >= 1, JSON.stringify(saved));

    // ---------- カテゴリ ----------
    await page.goto(BASE + '#/categories', { waitUntil: 'networkidle' });
    await page.waitForSelector('.catcard', { timeout: 10000 });
    const cats = await page.locator('.catcard').count();
    step('カテゴリ一覧が出る', cats >= 1, `${cats} 件`);
    await shot('04-categories');

    // カード内のテキストが重なっていないか。
    // <span> を display:block にし忘れると名前と説明が同じ行に載る（実測で踏んだ）。
    const overlap = await page.$$eval('.catcard', (cards) => {
      for (const c of cards) {
        const n = c.querySelector('.catcard__name');
        const m = c.querySelector('.catcard__meta');
        if (!n || !m) continue;
        const a = n.getBoundingClientRect();
        const b = m.getBoundingClientRect();
        // 縦にも横にも重なっていたら不正
        if (a.bottom > b.top + 1 && a.right > b.left + 1 && b.right > a.left + 1) {
          return n.textContent.trim() + ' / ' + m.textContent.trim();
        }
      }
      return null;
    });
    step('カード内のテキストが重なっていない', overlap === null, overlap || '');

    // 寸法指定が効かず SVG が既定サイズで描かれると、カードを突き破って巨大化する。
    // 実測でリングが 500px 超に膨らんだので、上限を機械で見張る。
    const oversized = await page.$$eval('.catcard svg, .sitrow svg', (els) => {
      for (const e of els) {
        const r = e.getBoundingClientRect();
        if (r.width > 80 || r.height > 80) {
          return `${e.getAttribute('class') || e.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`;
        }
      }
      return null;
    });
    step('カード内の SVG が想定サイズに収まっている', oversized === null, oversized || '');

    // カテゴリ一覧でも横スクロールが出ていないこと
    const catOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    step('カテゴリ一覧で横スクロールが発生しない', catOverflow <= 1, `${catOverflow}px`);

    // データが入っているカテゴリを直接開く（未作成カテゴリは空状態になる）
    await page.goto(BASE + '#/categories/transport', { waitUntil: 'networkidle' });
    await page.waitForSelector('.sitrow, .empty', { timeout: 10000 });
    const sitrows = await page.locator('.sitrow').count();
    step('カテゴリ詳細に状況一覧が出る', sitrows > 0, `${sitrows} 件`);

    // 未作成カテゴリでも落ちずに案内が出ること
    await page.goto(BASE + '#/categories/school', { waitUntil: 'networkidle' });
    await page.waitForSelector('.sitrow, .empty', { timeout: 10000 });
    step('未作成カテゴリでも画面が壊れない', true);

    // ---------- 保存 ----------
    await page.goto(BASE + '#/bookmarks', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    step('保存画面が開く', (await page.locator('.empty, .sitrow').count()) > 0);

    // ---------- 設定 ----------
    await page.goto(BASE + '#/settings', { waitUntil: 'networkidle' });
    await page.waitForSelector('.setrow', { timeout: 10000 });
    step('設定画面が開く', true);

    // ダークモードに切り替える
    await page.locator('.seg__btn[data-set="theme"][data-val="dark"]').click();
    await page.waitForTimeout(250);
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    step('ダークモードに切り替わる', theme === 'dark', String(theme));
    await shot('05-settings-dark');

    // 文字サイズ
    await page.locator('.seg__btn[data-set="textSize"][data-val="l"]').click();
    await page.waitForTimeout(200);
    const ts = await page.evaluate(() => document.documentElement.getAttribute('data-text'));
    step('文字サイズを変えられる', ts === 'l', String(ts));

    // 横スクロールが出ていないか（狭い画面での日本語折り返し事故の検出）
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    step('横スクロールが発生しない（文字サイズ大）', overflow <= 1, `${overflow}px`);

    // ライトへ戻す
    await page.locator('.seg__btn[data-set="theme"][data-val="light"]').click();
    await page.locator('.seg__btn[data-set="textSize"][data-val="m"]').click();
    await page.waitForTimeout(150);

    // ---------- インストール案内 ----------
    await page.goto(BASE + '#/install', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    step('インストール案内が開く',
      (await page.locator('text=ホーム画面に追加').count()) > 0);

    // ---------- manifest / SW ----------
    const mf = await page.evaluate(async (base) => {
      const r = await fetch(base + 'manifest.webmanifest');
      return r.ok ? await r.json() : null;
    }, BASE);
    step('manifest が配信される', !!mf && mf.short_name === 'eikAIwa');

    const swReg = await page.evaluate(() =>
      navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then((r) => r.length) : 0);
    step('Service Worker が登録される', swReg >= 1, `${swReg} 件`);

    // ---------- 404 ルート ----------
    await page.goto(BASE + '#/nope', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    step('未知のルートで落ちずに案内が出る',
      (await page.locator('text=ページが見つかりません').count()) > 0);

    // ---------- コンソールエラー ----------
    const real = consoleErrors.filter((t) =>
      !/favicon/i.test(t) && !/net::ERR_/.test(t));
    step('コンソールエラーが出ていない', real.length === 0,
      real.slice(0, 3).join(' | '));

  } catch (e) {
    step('通し実行', false, e.message);
  } finally {
    await browser.close();
  }

  const ng = steps.filter((s) => !s.ok).length;
  console.log('');
  console.log(`  ${steps.length - ng} / ${steps.length} 合格`);
  if (ng) {
    console.log('');
    problems.forEach((p) => console.log('  [失敗] ' + p));
    process.exit(1);
  }
  process.exit(0);
})();
