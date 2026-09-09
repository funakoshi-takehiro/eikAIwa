/*
 * オフライン動作の確認（Playwright / Chromium）
 *
 * 本アプリの中心的な約束は「一度開けば通信なしで学習できる」こと。
 * これは静的チェックでは絶対に検出できず、オンラインで触っている限り
 * 気づけない種類の不具合なので、実際にネットワークを落として確かめる。
 *
 * 手順:
 *   1. オンラインで開き、Service Worker がプリキャッシュを終えるまで待つ
 *   2. context.setOffline(true) で通信を遮断する
 *   3. リロードして、ホーム → 練習 → 10解答 → 自己評価 が一周できるか見る
 *
 * 使い方:
 *   NODE_PATH=/opt/node22/lib/node_modules node tools/offline_test.js
 */
'use strict';

const { chromium } = require('playwright');

const BASE = process.env.SMOKE_URL || 'http://localhost:8080/eikAIwa/';
const SHOT_DIR = process.env.SMOKE_SHOTS || '';

const steps = [];
function step(name, ok, detail) {
  steps.push({ name, ok });
  console.log(`  ${ok ? 'ok ' : 'NG '} ${name}${detail ? '  — ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, locale: 'ja-JP',
  });
  const page = await ctx.newPage();

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  try {
    // ---------- 1. オンラインで開いてプリキャッシュを待つ ----------
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForSelector('.hero', { timeout: 15000 });

    // SW が activate し、全カテゴリのプリキャッシュが載るまで待つ
    const cached = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      // プリキャッシュは install 中に走る。キャッシュに入るまでポーリングする
      for (let i = 0; i < 40; i++) {
        const keys = await caches.keys();
        for (const k of keys) {
          if (!k.startsWith('eikaiwa-')) continue;
          const c = await caches.open(k);
          const reqs = await c.keys();
          const paths = reqs.map((r) => new URL(r.url).pathname);
          const dataFiles = paths.filter((p) => p.includes('/data/situations/'));
          const hasShell = paths.some((p) => p.endsWith('/index.html'))
                        && paths.some((p) => p.endsWith('/js/main.js'))
                        && paths.some((p) => p.endsWith('/css/style.css'));
          if (hasShell && dataFiles.length >= 13) {
            return { ok: true, total: paths.length, data: dataFiles.length };
          }
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      return { ok: false };
    });
    step('Service Worker が全アセットをプリキャッシュした',
      cached.ok, cached.ok ? `${cached.total} 件（うち問題データ ${cached.data} 件）` : 'タイムアウト');

    // ---------- 2. 通信を遮断する ----------
    await ctx.setOffline(true);
    step('ネットワークを遮断した', true);

    // 本当にオフラインか確認する
    const reallyOffline = await page.evaluate(async () => {
      try {
        await fetch('https://example.com', { mode: 'no-cors', cache: 'no-store' });
        return false;
      } catch (e) { return true; }
    });
    step('外部通信が実際に遮断されている', reallyOffline);

    // ---------- 3. オフラインのままリロードして一周する ----------
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hero', { timeout: 15000 });
    step('オフラインでもホームが開く', true);

    const catCount = await page.evaluate(async (base) => {
      const r = await fetch(base + 'data/categories.json');
      const j = await r.json();
      return j.categories.length;
    }, BASE);
    step('オフラインでカテゴリ定義を読める', catCount === 13, `${catCount} カテゴリ`);

    await page.locator('a[href="#/practice/daily"]').first().click();
    await page.waitForSelector('.sit__want', { timeout: 15000 });
    const want = (await page.locator('.sit__want').first().innerText()).trim();
    step('オフラインで状況カードが出る', want.length > 0, want.slice(0, 44));

    await page.locator('#reveal').click();
    await page.waitForSelector('.ans__item', { timeout: 15000 });
    const n = await page.locator('.ans__item').count();
    step('オフラインで10通りの解答が出る', n === 10, `${n} 件`);

    if (SHOT_DIR) {
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOT_DIR}/offline-answers.png` });
    }

    await page.locator('.judge__btn[data-j="got"]').click();
    await page.waitForSelector('.sit__want', { timeout: 15000 });
    step('オフラインで自己評価して次へ進める', true);

    await page.waitForTimeout(400);
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem('eikAIwa.v1');
      return raw ? Object.keys(JSON.parse(raw).progress || {}).length : 0;
    });
    step('オフラインでも学習履歴が保存される', saved >= 1, `${saved} 件`);

    // 別カテゴリもオフラインで読めるか（全13カテゴリがキャッシュされている確認）
    await page.goto(BASE + '#/categories/trouble', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sitrow, .empty', { timeout: 15000 });
    const rows = await page.locator('.sitrow').count();
    step('オフラインで他カテゴリの問題も読める', rows === 15, `緊急・トラブル ${rows} 問`);

    step('ページ内エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' | '));

  } catch (e) {
    step('オフライン通し実行', false, e.message);
  } finally {
    await browser.close();
  }

  const ng = steps.filter((s) => !s.ok).length;
  console.log('');
  console.log(`  ${steps.length - ng} / ${steps.length} 合格`);
  process.exit(ng ? 1 : 0);
})();
