/* =====================================================================
   ChenMe 待機ページ ― 本体
   ---------------------------------------------------------------------
   状態遷移：
     waiting   … 通常の待機中
     imminent  … 販売直前（既定：10分前〜）
     final     … ラスト1分（秒を強調）
     onsale    … 販売中（Amazon CTA が最優先）
     soldout   … 販売終了（手動切替）
   ===================================================================== */

(function (w, d) {
  'use strict';

  var CFG = w.CHENME_CONFIG || {};
  var COPY = CFG.copy || {};
  var track = (w.ChenMeAnalytics && w.ChenMeAnalytics.track) || function () {};
  var openedAt = (w.ChenMeAnalytics && w.ChenMeAnalytics.openedAt) || Date.now();

  var root = d.documentElement;
  var $ = function (id) { return d.getElementById(id); };

  var el = {
    fvWaiting: d.querySelector('[data-view="waiting"]'),
    fvOnSale:  d.querySelector('[data-view="onsale"]'),
    fvSoldOut: d.querySelector('[data-view="soldout"]'),
    eyebrow:   $('eyebrow'),
    headline:  $('headline'),
    saleAt:    $('saleAt'),
    countdown: $('countdown'),
    cdDays:    $('cdDays'),
    cdDaysNum: $('cdDaysNum'),
    cdH: $('cdH'), cdM: $('cdM'), cdS: $('cdS'), cdSr: $('cdSr'),
    sticky:    $('sticky'),
    livebar:   $('livebar'),
    records:   $('records'),
    recordsList: $('recordsList'),
    notifySlot: $('notifySlot'),
    notifyNote: $('notifyNote'),
    notifyTitle: $('notifyTitle'),
    notifyLead: $('notifyLead')
  };

  /* ---------------------------------------------------------------
     1. 日時のパース（設定は常に日本時間として解釈する）
     --------------------------------------------------------------- */
  function parseJst(str) {
    var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(str || '').trim());
    if (!m) return null;
    /* JST(+09:00) 固定で解釈 → 閲覧者の端末タイムゾーンに左右されない */
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 9, +m[5], 0);
    return isNaN(t) ? null : new Date(t);
  }

  var saleDate = parseJst(CFG.nextSaleAt);

  /* ---------------------------------------------------------------
     1-b. プレビュー（?preview=... のときだけ動く確認用モード）
     ---------------------------------------------------------------
     関係者に実機で全部の状態を見てもらうための仕組みです。
     URL に ?preview= を付けたときだけ有効で、通常の閲覧には一切影響しません。
     プレビュー中は計測を送らず、画面上部に必ずプレビュー表示だと分かる
     バーを出します（本物の販売状況と誤解されないようにするため）。

       ?preview=waiting    待機中
       ?preview=imminent   販売10分前
       ?preview=final      販売1分前（そのまま見ていると販売開始に切り替わります）
       ?preview=onsale     販売中
       ?preview=soldout    販売終了
       ?preview=live&sec=90  90秒後に販売開始（切り替わる瞬間を見せたいとき）
     --------------------------------------------------------------- */
  var PREVIEW_OFFSET_MS = {
    waiting:  3 * 86400000,
    imminent: 5 * 60000,
    final:    40000
  };
  var PREVIEW_LABEL = {
    waiting: '待機中', imminent: '10分前', final: '1分前',
    onsale: '販売中', soldout: '販売終了', live: 'カウント中'
  };
  var PREVIEW = null;

  function setupPreview() {
    var q = new URLSearchParams(w.location.search);
    var p = q.get('preview');
    if (!p) return;

    PREVIEW = p;
    root.setAttribute('data-preview', '');

    var sec = parseInt(q.get('sec'), 10);
    if (p === 'live' && sec > 0) {
      saleDate = new Date(Date.now() + sec * 1000);
      CFG.saleStatus = 'auto';
    } else if (p === 'onsale') {
      CFG.saleStatus = 'on_sale';
    } else if (p === 'soldout') {
      CFG.saleStatus = 'sold_out';
    } else if (PREVIEW_OFFSET_MS[p] != null) {
      saleDate = new Date(Date.now() + PREVIEW_OFFSET_MS[p]);
      CFG.saleStatus = 'auto';
    }
  }

  /* プレビューバー（これがあるので本物の販売状況と取り違えられない） */
  function buildPreviewBar() {
    if (!PREVIEW) return;

    var bar = d.createElement('div');
    bar.className = 'preview-bar';

    var head = d.createElement('div');
    head.className = 'preview-bar__head';
    head.innerHTML =
      '<span class="preview-bar__tag">PREVIEW</span>' +
      '<span class="preview-bar__note">確認用の表示です。実際の販売状況ではありません。</span>';
    bar.appendChild(head);

    var nav = d.createElement('nav');
    nav.className = 'preview-bar__nav';
    ['waiting', 'imminent', 'final', 'onsale', 'soldout'].forEach(function (key) {
      var a = d.createElement('a');
      a.className = 'preview-bar__btn' + (key === PREVIEW ? ' is-current' : '');
      a.href = '?preview=' + key;
      a.textContent = PREVIEW_LABEL[key];
      nav.appendChild(a);
    });
    bar.appendChild(nav);

    d.body.appendChild(bar);
  }

  function formatSaleAt(date) {
    if (!date) return '—';
    /* 表示も日本時間で固定 */
    var p = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(date).reduce(function (a, x) { a[x.type] = x.value; return a; }, {});
    return p.year + '.' + p.month + '.' + p.day + '  ' + p.hour + ':' + p.minute;
  }

  /* ---------------------------------------------------------------
     2. 文言の流し込み
     --------------------------------------------------------------- */
  function nl2br(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  function applyCopy() {
    if (COPY.eyebrow)      el.eyebrow.textContent = COPY.eyebrow;
    if (COPY.headline)     el.headline.innerHTML = nl2br(COPY.headline);
    if (COPY.onSaleTitle)  $('onSaleTitle').innerHTML = nl2br(COPY.onSaleTitle);
    if (COPY.onSaleLead)   $('onSaleLead').innerHTML = nl2br(COPY.onSaleLead);
    if (COPY.soldOutTitle) $('soldOutTitle').innerHTML = nl2br(COPY.soldOutTitle);
    if (COPY.soldOutLead)  $('soldOutLead').innerHTML = nl2br(COPY.soldOutLead);
    if (COPY.brandCopy)    $('brandCopy').innerHTML = nl2br(COPY.brandCopy);
    if (COPY.brandName)    $('brandName').textContent = COPY.brandName;
    el.saleAt.textContent = formatSaleAt(saleDate);

    if (COPY.ctaAmazon) {
      Array.prototype.forEach.call(d.querySelectorAll('[data-amazon] .btn__label'), function (n) {
        n.textContent = COPY.ctaAmazon;
      });
    }
  }

  /* ---------------------------------------------------------------
     3. Amazon リンク（設定ファイルから注入・直書きしない）
     --------------------------------------------------------------- */
  /* 商品ページではなく Amazon のトップに飛ばしてしまう事故を検知する。
     待たせた人を全員トップページに流すのが最悪の失敗なので、
     設定ミスに気づけるよう警告を出す（表示や遷移そのものは妨げない）。 */
  function checkAmazonUrl(url) {
    if (!url) return '未設定です。config.js の amazonUrl に商品ページのURLを入れてください。';
    var m = /^https?:\/\/([^/?#]+)([^?#]*)/i.exec(url);
    if (!m) return 'URLの形式が正しくない可能性があります: ' + url;
    var host = m[1].toLowerCase(), pathname = m[2] || '/';
    /* 短縮URLは遷移先が分からないので形式チェックの対象外 */
    if (/^(amzn\.to|amzn\.asia|a\.co)$/.test(host)) return null;
    if (/(^|\.)amazon\./.test(host) && !/\/(dp|gp)\//.test(pathname)) {
      return 'Amazonのトップページを指している可能性があります（/dp/ が含まれていません）: ' + url;
    }
    return null;
  }

  /* href の更新だけ。設定を読み直したあとにも呼べるよう、
     クリックの登録（wireAmazon）とは分けてある。 */
  var lastAmazonUrl = null;
  function updateAmazonHrefs() {
    var url = (CFG.amazonUrl || '').trim();
    if (url === lastAmazonUrl) return;
    lastAmazonUrl = url;

    var problem = checkAmazonUrl(url);
    if (problem) console.warn('[ChenMe] Amazon URL の確認: ' + problem);

    Array.prototype.forEach.call(d.querySelectorAll('[data-amazon]'), function (a) {
      a.setAttribute('href', url || '#');
      a.setAttribute('rel', 'noopener');
      if (url) a.removeAttribute('aria-disabled');
      else a.setAttribute('aria-disabled', 'true');
    });
  }

  function wireAmazon() {
    updateAmazonHrefs();

    Array.prototype.forEach.call(d.querySelectorAll('[data-amazon]'), function (a) {
      a.addEventListener('click', function () {
        track('amazon_click', {
          placement: a.id || 'unknown',
          waited_sec: Math.round((Date.now() - openedAt) / 1000)
        });
      });
    });
  }

  /* ---------------------------------------------------------------
     3-b. 設定の自動再読み込み
     ---------------------------------------------------------------
     ページを開いたままの人にも、運営側の変更が届くようにする。

     いちばん大事なのは SOLD OUT。売り切れて 'sold_out' に切り替えたとき、
     すでにページを開いている人の画面にも自動で反映される（リロード不要）。
     販売日時の変更や、Amazon URL の直しも同じように届く。

     ・販売中は 30秒ごと、それ以外は 5分ごと
     ・間隔は毎回 ±25% ずらす。販売開始の瞬間は全員が同時にページを
       見ているので、そこで一斉に取りに行かないようにするため
     ・タブが裏にあるあいだは確認しない（戻ってきたら即確認する）
     ・プレビュー表示中は確認しない（状態を上書きしてしまうため）
     ・反映されるのは 販売ステータス / 販売日時 / Amazon URL の3つ。
       文言や通知設定の変更はリロードで反映されます。
     --------------------------------------------------------------- */
  var POLL_MS_ONSALE = 30000;
  var POLL_MS_IDLE   = 300000;
  var configLoading = false;
  var nextPollAt = 0;

  /* 次に確認する時刻を決める。間隔をばらけさせて同時アクセスを避ける */
  function scheduleNextPoll(onsale) {
    var base = onsale ? POLL_MS_ONSALE : POLL_MS_IDLE;
    nextPollAt = Date.now() + base * (0.75 + Math.random() * 0.5);
  }

  function reloadConfigFile(done) {
    var s = d.createElement('script');
    s.src = 'config.js?t=' + Date.now();
    s.onload  = function () { s.remove(); done(true); };
    s.onerror = function () { s.remove(); done(false); };
    d.head.appendChild(s);
  }

  function applyConfigUpdate() {
    var next = w.CHENME_CONFIG;
    /* 読み込みに失敗して古いオブジェクトのままなら何もしない */
    if (!next || next === CFG) return;

    CFG = next;
    COPY = CFG.copy || {};

    var nd = parseJst(CFG.nextSaleAt);
    var changed = (nd ? nd.getTime() : 0) !== (saleDate ? saleDate.getTime() : 0);
    if (changed) {
      saleDate = nd;
      el.saleAt.textContent = formatSaleAt(saleDate);
      lastRender = {};                 /* カウントダウンを描き直させる */
    }

    updateAmazonHrefs();
    tick();                            /* 新しい設定で状態を再判定 */
  }

  function maybeReloadConfig() {
    if (PREVIEW || configLoading || d.hidden) return;
    if (Date.now() < nextPollAt) return;

    scheduleNextPoll(state === 'onsale');
    configLoading = true;
    reloadConfigFile(function (ok) {
      configLoading = false;
      if (ok) applyConfigUpdate();
    });
  }

  /* ---------------------------------------------------------------
     4. カウントダウン描画（桁を固定幅で置くので数字が揺れない）
     --------------------------------------------------------------- */
  function digits(n) {
    var s = String(n).padStart(2, '0'), out = '';
    for (var i = 0; i < s.length; i++) out += '<span class="d">' + s[i] + '</span>';
    return out;
  }

  var lastRender = {};
  function setCell(node, key, value) {
    if (lastRender[key] === value) return;
    lastRender[key] = value;
    node.innerHTML = digits(value);
  }

  function renderCountdown(msLeft) {
    var s = Math.max(0, Math.floor(msLeft / 1000));
    var days = Math.floor(s / 86400);
    var h = Math.floor((s % 86400) / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;

    el.cdDays.hidden = days <= 0;
    if (days > 0) setCell(el.cdDaysNum, 'd', days);
    setCell(el.cdH, 'h', h);
    setCell(el.cdM, 'm', m);
    setCell(el.cdS, 's', sec);

    /* スクリーンリーダー向けは1分に1回だけ更新（読み上げ連打を防ぐ） */
    if (sec === 0) {
      el.cdSr.textContent = '販売開始まで、あと' +
        (days > 0 ? days + '日' : '') + h + '時間' + m + '分';
    }
  }

  /* ---------------------------------------------------------------
     5. 状態の決定と反映
     --------------------------------------------------------------- */
  var IMMINENT_MS = Math.max(1, Number(CFG.imminentMinutes) || 10) * 60 * 1000;
  var state = null;
  var saleStartedFired = false;

  function resolveState(now) {
    var forced = CFG.saleStatus;
    if (forced === 'sold_out') return 'soldout';
    if (forced === 'on_sale')  return 'onsale';

    if (!saleDate) return 'waiting';
    var left = saleDate.getTime() - now;

    if (forced === 'waiting') {
      return left <= 0 ? 'waiting' : (left <= 60000 ? 'final' : (left <= IMMINENT_MS ? 'imminent' : 'waiting'));
    }
    if (left <= 0)      return 'onsale';
    if (left <= 60000)  return 'final';
    if (left <= IMMINENT_MS) return 'imminent';
    return 'waiting';
  }

  function applyState(next, opts) {
    if (next === state) return;
    var prev = state;
    state = next;
    root.setAttribute('data-state', next);

    var waiting = (next === 'waiting' || next === 'imminent' || next === 'final');

    el.fvWaiting.hidden = !waiting;
    el.fvOnSale.hidden  = (next !== 'onsale');
    el.fvSoldOut.hidden = (next !== 'soldout');
    el.sticky.hidden    = (next !== 'onsale');
    el.livebar.hidden   = (next !== 'onsale');

    /* 販売直前は見出しを差し替え（煽らず、静かに緊張感を上げる） */
    if (next === 'imminent' || next === 'final') {
      el.eyebrow.textContent = COPY.imminentLabel || 'もうすぐ販売スタート';
      el.headline.innerHTML = nl2br(
        next === 'final'
          ? (COPY.finalHeadline || '販売スタートまで、あと少し。')
          : (COPY.imminentHeadline || 'もうすぐ、会える。')
      );
    } else if (next === 'waiting') {
      el.eyebrow.textContent = COPY.eyebrow || 'NEXT DROP';
      el.headline.innerHTML = nl2br(COPY.headline || '次の販売まで、\nここで待っててね。');
    }

    /* SOLD OUT のときは通知セクションの文言を「次回に向けて」に差し替え */
    if (next === 'soldout') {
      el.notifyTitle.textContent = COPY.soldOutNotifyTitle || '次回販売のお知らせを受け取る';
      el.notifyLead.textContent  = COPY.soldOutNotifyLead  || '次の販売が決まったら、お知らせします。';
    } else {
      el.notifyTitle.textContent = COPY.notifyTitle || '販売スタートをお知らせ';
      el.notifyLead.textContent  = COPY.notifyLead  || '販売が始まったら、すぐ見に行けるように。';
    }

    /* 販売中は確認の間隔を短くする。
       販売開始の瞬間に切り替わった人も、すでに販売中の状態で開いた人も
       同じように拾う必要がある（後者が SOLD OUT を一番知りたい人なので）。
       ここで即座に取りに行かないのは、販売開始の瞬間に全員が
       一斉にアクセスするのを避けるため。 */
    if (next === 'onsale') {
      var soon = Date.now() + POLL_MS_ONSALE * (0.75 + Math.random() * 0.5);
      if (nextPollAt > soon) nextPollAt = soon;
    }

    /* --- 計測 --- */
    if (next === 'onsale' && !saleStartedFired) {
      saleStartedFired = true;
      track('sale_started', {
        /* live = 販売開始の瞬間にページを開いていた人（ここがファネルの肝） */
        trigger: (opts && opts.initial) ? 'load' : 'live',
        waited_sec: Math.round((Date.now() - openedAt) / 1000)
      });
    }
    if (next === 'soldout') track('sold_out_view', {}, { once: true });

    /* 販売開始に切り替わったら、スクロール位置に関わらず上に戻す
       （上部バー＋下部固定CTAで、どこにいても1タップで届く状態も併用） */
    if (next === 'onsale' && prev && prev !== 'onsale') {
      try { w.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { w.scrollTo(0, 0); }
    }
  }

  /* ---------------------------------------------------------------
     6. ループ（表示は毎秒、判定は都度。バックグラウンド復帰にも対応）
     --------------------------------------------------------------- */
  function tick() {
    var now = Date.now();
    applyState(resolveState(now));
    if (saleDate && state !== 'onsale' && state !== 'soldout') {
      renderCountdown(saleDate.getTime() - now);
    }
  }

  /* 表示の更新とは別サイクル。時刻を見るだけなので毎回呼んでも軽い */
  function pollTick() { maybeReloadConfig(); }

  function startLoop() {
    tick();
    /* 250ms 間隔で判定 → 秒の切り替わりが遅れない。描画は値が変わった時だけ */
    setInterval(tick, 250);
    /* 設定の確認は別サイクル（実際の再取得は 30秒 / 5分 の間隔でだけ走る） */
    setInterval(pollTick, 2000);
    d.addEventListener('visibilitychange', function () { if (!d.hidden) { tick(); pollTick(); } });
    w.addEventListener('pageshow', tick);
    w.addEventListener('focus', tick);
  }

  /* ---------------------------------------------------------------
     7. 通知コンポーネント（LINE / メール / 準備中）
     --------------------------------------------------------------- */
  function buildNotify() {
    var n = CFG.notify || {};
    var mode = n.mode || 'disabled';
    el.notifyNote.textContent = n.note || '';

    if (mode === 'url' && n.url) {
      var a = d.createElement('a');
      a.className = 'btn btn--notify';
      a.href = n.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = n.buttonLabel || 'お知らせを受け取る';
      a.addEventListener('click', function () { track('notification_click', { method: 'url' }); });
      el.notifySlot.appendChild(a);
      return;
    }

    if (mode === 'email' && n.endpoint) {
      var form = d.createElement('form');
      form.className = 'notify__form';
      form.noValidate = true;
      form.innerHTML =
        '<input class="notify__input" type="email" name="email" inputmode="email" ' +
        'autocomplete="email" placeholder="メールアドレス" required>' +
        '<button class="btn btn--notify" type="submit">' +
        (n.buttonLabel || 'お知らせを受け取る') + '</button>' +
        '<p class="notify__msg" role="status"></p>';

      var msg = form.querySelector('.notify__msg');
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var input = form.querySelector('input');
        if (!input.value || input.validity.typeMismatch || input.value.indexOf('@') < 0) {
          msg.textContent = 'メールアドレスの形式をご確認ください。';
          return;
        }
        track('notification_click', { method: 'email' });
        msg.textContent = '送信中…';
        fetch(n.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: input.value })
        }).then(function (r) {
          msg.textContent = r.ok
            ? '登録しました。販売開始のお知らせをお送りします。'
            : '送信できませんでした。少し時間をおいてお試しください。';
          if (r.ok) form.reset();
        }).catch(function () {
          msg.textContent = '送信できませんでした。少し時間をおいてお試しください。';
        });
      });
      el.notifySlot.appendChild(form);
      return;
    }

    /* 未接続時：押せないボタンを置き、誤解のない文言にする */
    var b = d.createElement('span');
    b.className = 'btn btn--ghost';
    b.setAttribute('aria-disabled', 'true');
    b.textContent = 'お知らせ機能は準備中です';
    el.notifySlot.appendChild(b);
  }

  /* ---------------------------------------------------------------
     8. 過去の販売実績（データがあるときだけ表示。架空の数字は入れない）
     --------------------------------------------------------------- */
  function buildRecords() {
    var list = Array.isArray(CFG.salesRecords) ? CFG.salesRecords : [];
    if (!list.length) return;                 /* 空なら非表示のまま */
    list.forEach(function (r) {
      var li = d.createElement('li');
      var b = d.createElement('b');
      b.textContent = r.date || '';
      var span = d.createElement('span');
      span.textContent = r.text || '';
      li.appendChild(b); li.appendChild(span);
      el.recordsList.appendChild(li);
    });
    el.records.hidden = false;
  }

  /* ---------------------------------------------------------------
     9. 画像が未設置でも崩れないようにする
     --------------------------------------------------------------- */
  function guardImages() {
    Array.prototype.forEach.call(d.querySelectorAll('img[data-img]'), function (img) {
      img.addEventListener('error', function () {
        img.classList.add('is-missing');
        var fig = img.closest('figure');
        if (fig) fig.classList.add('is-missing');
      });
      if (img.complete && img.naturalWidth === 0) img.dispatchEvent(new Event('error'));
    });
  }

  /* ---------------------------------------------------------------
     10. スクロール系
     --------------------------------------------------------------- */
  function wireMisc() {
    Array.prototype.forEach.call(d.querySelectorAll('[data-scroll]'), function (a) {
      a.addEventListener('click', function (ev) {
        var target = d.querySelector(a.getAttribute('href'));
        if (!target) return;
        ev.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    /* カウントダウンが実際に見られたか */
    if ('IntersectionObserver' in w) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            track('countdown_view', {}, { once: true });
            io.disconnect();
          }
        });
      }, { threshold: 0.6 });
      io.observe(el.countdown);
    } else {
      track('countdown_view', {}, { once: true });
    }
  }

  /* ---------------------------------------------------------------
     起動
     --------------------------------------------------------------- */
  setupPreview();          /* ?preview= があるときだけ、日時と状態を差し替える */

  applyCopy();
  wireAmazon();
  buildNotify();
  buildRecords();
  guardImages();
  buildPreviewBar();

  scheduleNextPoll(false);   /* 最初の設定確認をばらけた時刻に予約する */

  var initialState = resolveState(Date.now());
  root.setAttribute('data-state', initialState);          /* 計測の page_state を正しくするため先に反映 */
  track('waiting_page_view', { has_sale_date: !!saleDate });
  applyState(initialState, { initial: true });

  wireMisc();
  startLoop();

})(window, document);
