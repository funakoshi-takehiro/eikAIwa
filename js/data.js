/* ── 問題データの読み込み ──────────────────────────────────────────────────
   data/categories.json とカテゴリ別 JSON を読む。
   Service Worker がプリキャッシュするのでオフラインでも取得できる。
   ────────────────────────────────────────────────────────────────────────── */
'use strict';

EIK.Data = (function () {
  var categories = null;
  var byCat = {};        // category -> situations[]
  var all = null;        // 全状況（フラット）
  var index = {};        // id -> situation

  function fetchJson(rel) {
    return fetch(EIK.url(rel) + '?v=' + EIK.VERSION, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error(rel + ' の取得に失敗しました (' + r.status + ')');
        return r.json();
      });
  }

  function loadCategories() {
    if (categories) return Promise.resolve(categories);
    return fetchJson('data/categories.json').then(function (j) {
      categories = j.categories || [];
      return categories;
    });
  }

  function loadCategory(id) {
    if (byCat[id]) return Promise.resolve(byCat[id]);
    return fetchJson('data/situations/' + id + '.json').then(function (j) {
      var list = j.situations || [];
      byCat[id] = list;
      list.forEach(function (s) { index[s.id] = s; });
      return list;
    });
  }

  /* 全カテゴリを読む。1件でも落ちたら全体を止めるのではなく、
     読めたぶんだけで動かす（オフライン中の部分的な失敗で学習を止めない）。 */
  function loadAll() {
    if (all) return Promise.resolve(all);
    return loadCategories().then(function (cats) {
      return Promise.all(cats.map(function (c) {
        return loadCategory(c.id).catch(function (e) {
          console.warn('カテゴリを読めませんでした: ' + c.id, e);
          return [];
        });
      }));
    }).then(function (lists) {
      all = [];
      lists.forEach(function (l) { all = all.concat(l); });
      return all;
    });
  }

  function get(id) { return index[id] || null; }

  function categoryMeta(id) {
    if (!categories) return null;
    for (var i = 0; i < categories.length; i++) {
      if (categories[i].id === id) return categories[i];
    }
    return null;
  }

  function inCategory(id) { return byCat[id] || []; }

  return {
    loadCategories: loadCategories,
    loadCategory: loadCategory,
    loadAll: loadAll,
    get: get,
    categoryMeta: categoryMeta,
    inCategory: inCategory,
    allCategories: function () { return categories || []; }
  };
})();
