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
  function wireAmazon() {
    var url = (CFG.amazonUrl || '').trim();
    Array.prototype.forEach.call(d.querySelectorAll('[data-amazon]'), function (a) {
      a.setAttribute('href', url || '#');
      a.setAttribute('rel', 'noopener');
      if (!url) a.setAttribute('aria-disabled', 'true');
      a.addEventListener('click', function () {
        track('amazon_click', {
          placement: a.id || 'unknown',
          waited_sec: Math.round((Date.now() - openedAt) / 1000)
        });
      });
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

  function startLoop() {
    tick();
    /* 250ms 間隔で判定 → 秒の切り替わりが遅れない。描画は値が変わった時だけ */
    setInterval(tick, 250);
    d.addEventListener('visibilitychange', function () { if (!d.hidden) tick(); });
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
  applyCopy();
  wireAmazon();
  buildNotify();
  buildRecords();
  guardImages();

  var initialState = resolveState(Date.now());
  root.setAttribute('data-state', initialState);          /* 計測の page_state を正しくするため先に反映 */
  track('waiting_page_view', { has_sale_date: !!saleDate });
  applyState(initialState, { initial: true });

  wireMisc();
  startLoop();

})(window, document);
