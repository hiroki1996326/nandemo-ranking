// Cloudflare Worker（静的アセットの前段ルーター）。
//
// 目的: 正規のSPAルート（/, /topic/*, /category/*, /entity/*）と実在する
// 静的ファイルは従来どおり200で配信し、それ以外の存在しないパス
// （廃止した /entity-type/* や打ち間違いなど）は本物の 404 を返す。
//
// assets の not_found_handling は "single-page-application" のまま残してある。
// これは run_worker_first により本Workerが先に走るための保険で、万一Workerが
// バイパスされても記事ページ（/topic/* 等）が壊れないようにするフェイルセーフ。

// 拡張子つき（=実ファイル要求: .css/.js/.png/.webp/.xml/.ico/.txt など）
const HAS_EXT = /\.[a-zA-Z0-9]+$/;
// SPAが描画する正規のナビゲーションルート
const APP_ROUTE = /^\/(?:topic|category|entity)\//;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // 実ファイルでもなく、トップでもなく、正規SPAルートでもないパス
    // = 存在しないページ。SPAシェルを 404 ステータスで返す（本文はJSが
    // 「ページが見つかりません」を描画し、meta robots も noindex になる）。
    const isUnknown =
      path !== '/' && !HAS_EXT.test(path) && !APP_ROUTE.test(path);

    if (isUnknown) {
      const shell = await env.ASSETS.fetch(new URL('/index.html', url.origin));
      return new Response(shell.body, {
        status: 404,
        headers: new Headers(shell.headers),
      });
    }

    // それ以外は通常配信（静的ファイル、または not_found_handling による
    // index.html への SPA フォールバック）。
    return env.ASSETS.fetch(request);
  },
};
