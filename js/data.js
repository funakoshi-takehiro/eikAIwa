/* ── 問題データの読み込み ──────────────────────────────────────────────────
   data/categories.json と、カテゴリ×難易度ごとの JSON を読む。
   Service Worker がプリキャッシュするのでオフラインでも取得できる。

   ファイル名の規則:
     ★    (level 1) → data/situations/<category>.json
     ★★  (level 2) → data/situations/<category>-2.json
     ★★★(level 3) → data/situations/<category>-3.json

   段階は必要になったものだけ読む。900問すべてを常に持つと、
   スマホでの初回描画が無駄に重くなるため。
   ────────────────────────────────────────────────────────────────────────── */
'use strict';

EIK.Data = (function () {
  var categories = null;
  var levels = null;
  var byKey = {};        // "<category>@<level>" -> situations[]
  var byLevel = {};      // level -> 全状況（フラット）
  var index = {};        // id -> situation

  function fetchJson(rel) {
    return fetch(EIK.url(rel) + '?v=' + EIK.VERSION, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error(rel + ' の取得に失敗しました (' + r.status + ')');
        return r.json();
      });
  }

  function fileFor(catId, level) {
    return 'data/situations/' + catId + (level === 1 ? '' : '-' + level) + '.json';
  }

  function loadCategories() {
    if (categories) return Promise.resolve(categories);
    return fetchJson('data/categories.json').then(function (j) {
      categories = j.categories || [];
      levels = j.levels || [];
      return categories;
    });
  }

  function loadCategory(catId, level) {
    var key = catId + '@' + level;
    if (byKey[key]) return Promise.resolve(byKey[key]);
    return fetchJson(fileFor(catId, level)).then(function (j) {
      var list = j.situations || [];
      byKey[key] = list;
      list.forEach(function (s) { index[s.id] = s; });
      return list;
    });
  }

  /* ある段階の全カテゴリを読む。
     1件でも落ちたら全体を止めるのではなく、読めたぶんだけで動かす
     （オフライン中の部分的な失敗や、未作成の段階で学習を止めない）。 */
  function load(level) {
    level = level || 1;
    if (byLevel[level]) return Promise.resolve(byLevel[level]);
    return loadCategories().then(function (cats) {
      return Promise.all(cats.map(function (c) {
        return loadCategory(c.id, level).catch(function () {
          return [];   // 未作成のカテゴリは空として扱う
        });
      }));
    }).then(function (lists) {
      var out = [];
      lists.forEach(function (l) { out = out.concat(l); });
      byLevel[level] = out;
      return out;
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

  function levelMeta(level) {
    if (!levels) return null;
    for (var i = 0; i < levels.length; i++) {
      if (levels[i].level === level) return levels[i];
    }
    return null;
  }

  function inCategory(catId, level) { return byKey[catId + '@' + level] || []; }

  /* categories.json が宣言している、その段階の予定問数。
     まだ作られていない段階でも「準備中」を正しく出すために使う。 */
  function plannedCount(catId, level) {
    var c = categoryMeta(catId);
    if (!c || !c.counts) return 0;
    return c.counts[String(level)] || 0;
  }

  return {
    loadCategories: loadCategories,
    loadCategory: loadCategory,
    load: load,
    get: get,
    categoryMeta: categoryMeta,
    levelMeta: levelMeta,
    inCategory: inCategory,
    plannedCount: plannedCount,
    allCategories: function () { return categories || []; },
    allLevels: function () { return levels || []; }
  };
})();
