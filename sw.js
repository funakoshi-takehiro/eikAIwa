/* ==================================================================
   eikAIwa — Service Worker

   目的: 一度開いたあとは、通信が無くても学習を続けられるようにする。
        （地下鉄・機内・海外でのローミング断など）

   方針:
     - アプリシェルと問題データは「プリキャッシュ + キャッシュ優先」。
       外部への依存がゼロなので、ネットワークを待つ理由がない。
     - バックグラウンドで更新を取りに行き、新しい版が入ったらページ側に
       「再読み込み」バーを出させる（キャッシュ固着を防ぐ）。
     - VERSION を上げると古いキャッシュを捨てる。
       CSS/JS を変更したら index.html の ?v= と ここの VERSION を必ず両方上げる。
       （更新漏れは .github/tools/precheck.py が検出する）
     - Google Fonts だけは別キャッシュに置く。本体の版を上げるたびに
       フォントを取り直すのは無駄なため。取得できなくても
       システムフォントに落ちるので致命的にはならない。
   ================================================================== */
'use strict';

const VERSION = 'eikaiwa-20260908j';
const CACHE = VERSION;
const FONT_CACHE = 'eikaiwa-fonts-v1';

/* SW 自身の位置からベースパスを導く。
   GitHub Pages のプロジェクトページ (/eng_std/) でも独自ドメイン (/) でも
   同じコードで動かすため、パスをハードコードしない。 */
const BASE = new URL('./', self.location).pathname;

const SHELL = [
  '',                       // ディレクトリ自体（= index.html）
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/base.js',
  'js/store.js',
  'js/data.js',
  'js/srs.js',
  'js/tts.js',
  'js/ui.js',
  'js/views/home.js',
  'js/views/practice.js',
  'js/views/categories.js',
  'js/views/bookmarks.js',
  'js/views/settings.js',
  'js/views/install.js',
  'js/router.js',
  'js/main.js',
  'icons/favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'data/categories.json'
];

const CATEGORY_IDS = [
  'airport', 'transport', 'hotel', 'restaurant', 'shopping', 'directions',
  'health', 'workplace', 'meeting', 'school', 'smalltalk', 'services', 'trouble'
];

// 難易度は3段階。ファイル名は ★ が <id>.json、★★ / ★★★ が <id>-2.json / <id>-3.json。
const LEVELS = [1, 2, 3];

function precacheUrls() {
  const urls = SHELL.map((p) => BASE + p);
  CATEGORY_IDS.forEach((id) => {
    LEVELS.forEach((lv) => {
      urls.push(BASE + 'data/situations/' + id + (lv === 1 ? '' : '-' + lv) + '.json');
    });
  });
  return urls;
}

function isFontHost(host) {
  return host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com';
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 1件でも 404 だと addAll 全体が失敗するので、個別に入れる。
    // （データファイルを増やす途中でも SW が壊れないようにする）
    await Promise.all(precacheUrls().map(async (u) => {
      try {
        const res = await fetch(u, { cache: 'reload' });
        if (res && res.ok) await cache.put(u, res);
      } catch (e) { /* 取れないものは飛ばす。オンライン時に自然に埋まる */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // 消すのは「自分が作った古い版」だけに限る
    await Promise.all(
      keys.filter((k) => k.startsWith('eikaiwa-') && k !== CACHE && k !== FONT_CACHE)
          .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // --- Google Fonts: キャッシュ優先 + 別キャッシュ ---
  if (isFontHost(url.host)) {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      } catch (e) {
        // フォントが取れなくてもシステムフォントに落ちるだけ
        return new Response('', { status: 504, statusText: 'offline' });
      }
    })());
    return;
  }

  // 自分のオリジン以外には手を出さない
  if (url.origin !== self.location.origin) return;

  // ナビゲーション（アドレスバーからの遷移・ホーム画面からの起動）は
  // 常に index.html を返す。ハッシュルータなので中身はこれ1枚でよい。
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(BASE + 'index.html');
      if (cached) {
        // バックグラウンドで更新を取りに行く（オフラインなら黙って失敗する）
        fetchAndPut(cache, BASE + 'index.html');
        return cached;
      }
      try { return await fetch(req); }
      catch (e) { return new Response('オフラインです。一度オンラインで開いてください。',
                                     { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
    })());
    return;
  }

  // --- それ以外: キャッシュ優先 + バックグラウンド更新 ---
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // ?v= が付いていても本体を引けるように、クエリを無視した照合も試す
    const hit = (await cache.match(req)) || (await cache.match(url.pathname));
    if (hit) {
      fetchAndPut(cache, req);
      return hit;
    }
    try {
      const res = await fetch(req);
      if (res && res.ok && url.origin === self.location.origin) {
        cache.put(url.pathname, res.clone());
      }
      return res;
    } catch (e) {
      return new Response('', { status: 504, statusText: 'offline' });
    }
  })());
});

function fetchAndPut(cache, reqOrUrl) {
  const key = typeof reqOrUrl === 'string' ? reqOrUrl : new URL(reqOrUrl.url).pathname;
  fetch(typeof reqOrUrl === 'string' ? reqOrUrl : reqOrUrl.url, { cache: 'no-cache' })
    .then((res) => { if (res && res.ok) cache.put(key, res); })
    .catch(() => { /* オフライン時は黙って諦める */ });
}
