/* =====================================================================
   ChenMe 待機ページ ― 計測レイヤー
   ---------------------------------------------------------------------
   GA4 / GTM / その他ツールの「接続口」を1か所にまとめています。
   config.js の analytics.ga4MeasurementId を入れるだけで GA4 に繋がります。

   ■ 計測するイベント
     waiting_page_view   … 待機ページを開いた
     countdown_view      … カウントダウンが画面に入った
     notification_click  … お知らせCTAを押した
     sale_started        … 販売開始に切り替わった
                            trigger:'live'  = 開始の瞬間にページを開いていた人
                            trigger:'load'  = 開始後にページを開いた人
     amazon_click        … Amazonボタンを押した
     sold_out_view       … 販売終了表示を見た

   ■ 見たいファネル（GA4 の探索 > 経路 or ファネル で作成）
     waiting_page_view
        → sale_started (trigger = live)    ← 販売開始時にもページにいた人
        → amazon_click
   ===================================================================== */

(function (w) {
  'use strict';

  var cfg = (w.CHENME_CONFIG && w.CHENME_CONFIG.analytics) || {};
  var id = (cfg.ga4MeasurementId || '').trim();

  /* --- プレビュー表示中は計測しない ---
     ?preview=... で開いた確認用の閲覧が、実際のファネルの数字を
     汚さないようにする。GA4 タグ自体も読み込まない。 */
  var isPreview = /[?&]preview=/.test(w.location.search);

  /* dataLayer は常に用意する（GTM を後入れする場合もここに溜まる） */
  w.dataLayer = w.dataLayer || [];

  /* --- GA4 を動的に読み込む（測定IDが入っているときだけ） --- */
  if (id && !isPreview) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);

    w.gtag = w.gtag || function () { w.dataLayer.push(arguments); };
    w.gtag('js', new Date());
    w.gtag('config', id, { send_page_view: false });
  }

  /* --- セッション内の識別子と滞在時間（ファネル分析用） --- */
  var openedAt = Date.now();
  var viewId = 'v' + openedAt.toString(36) + Math.random().toString(36).slice(2, 8);
  var fired = {};

  function baseParams() {
    return {
      view_id: viewId,
      page_state: document.documentElement.getAttribute('data-state') || 'unknown',
      elapsed_sec: Math.round((Date.now() - openedAt) / 1000)
    };
  }

  /**
   * イベント送信
   * @param {string} name   イベント名
   * @param {object} params 付随パラメータ
   * @param {object} opt    { once: true } で同名イベントの重複送信を防ぐ
   */
  function track(name, params, opt) {
    opt = opt || {};

    /* プレビュー中は送信せず、コンソールに出すだけにする */
    if (isPreview) {
      if (cfg.debug) console.log('[chenme:preview] 計測は送信しません:', name, params || {});
      return;
    }

    if (opt.once) {
      if (fired[name]) return;
      fired[name] = true;
    }

    var payload = Object.assign(baseParams(), params || {});

    w.dataLayer.push(Object.assign({ event: name }, payload));
    if (typeof w.gtag === 'function') w.gtag('event', name, payload);

    /* 他ツールを後から足したいときは、この CustomEvent を拾ってください */
    w.dispatchEvent(new CustomEvent('chenme:track', { detail: { name: name, params: payload } }));

    if (cfg.debug) console.log('[chenme:track]', name, payload);
  }

  w.ChenMeAnalytics = {
    track: track, viewId: viewId, openedAt: openedAt, isPreview: isPreview
  };
})(window);
