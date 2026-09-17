# ChenMe ― 次回販売 待機ページ

> 「次の販売まで、ここで待っててね。」

販売開始の瞬間に、待っていた人を **最短タップで Amazon の商品ページへ送る** ための待機ページです。
ビルド不要の静的サイト（HTML / CSS / JavaScript）なので、そのまま Cloudflare Pages に置けます。

---

## 1. いちばん大事なこと：運営が触るのは `config.js` だけ

販売日時・Amazon URL・販売状態・文言は、すべて **ルート直下の `config.js`** にまとまっています。
HTML や CSS を開く必要はありません。

```js
nextSaleAt: '2026-10-16 21:00',              // 次回販売日時（日本時間）
amazonUrl:  'https://www.amazon.co.jp/dp/XXXXXXXXXX',  // Amazon 商品ページ
saleStatus: 'auto',                          // auto / waiting / on_sale / sold_out
```

### 販売まわりの運用手順

| タイミング | やること |
|---|---|
| 販売日が決まったら | `nextSaleAt` を書き換える（`saleStatus` は `'auto'` のまま） |
| 販売前に必ず | `amazonUrl` が今回の商品ページになっているか確認 |
| 販売開始 | **なにもしなくてOK。** 時刻になったら自動で販売開始モードに切り替わります |
| 完売したら | `saleStatus` を `'sold_out'` に変更 |
| 次回に向けて | `nextSaleAt` を新しい日時にして、`saleStatus` を `'auto'` に戻す |

> 手動で今すぐ販売開始にしたい / 逆に止めたいときは、`saleStatus` を `'on_sale'` / `'waiting'` にします。

---

## 2. 画像（配置済み）

```
assets/img/logo.png           ChenMe ワードマーク（背景透過）
assets/img/product-hero.jpg   ファーストビュー：寝室カット
assets/img/brand-01.jpg       ブランド：モデルカット
assets/img/brand-02.jpg       ブランド：ボトル単体
assets/img/_source/           加工前の原本（ページからは未参照）
```

- 商品ボトルは **実物の撮影画像をそのまま** 使用しています。ラベル・ロゴ・イラスト・形状は一切加工していません。
- ロゴのみ、ヘッダーで使うため **背景の淡いピンクを透過** にしています（文字色 `rgb(106,102,99)` は実測値のまま、字形は無変更）。
- 差し替えは同じファイル名で上書き → `npm run images` で `.webp` 再生成。
- 加工内容の詳細は `assets/img/README.md` を参照してください。

---

## 3. 状態遷移

```
                    10分前            1分前           販売日時
  ┌─ waiting ─────────┼─ imminent ─────┼─ final ────────┼─→ onsale ──┐
  │  通常の待機        │ カウントダウン  │ 秒を強調        │ Amazon CTA │
  │                   │ を拡大・強調    │                │ が最優先    │
  └───────────────────┴────────────────┴────────────────┴────────────┘
                                                               │
                                        config.saleStatus='sold_out'
                                                               ↓
                                                          soldout
                                              「またここで待っててね。」
                                              ＋ 次回お知らせ CTA
```

| 状態 | 画面 |
|---|---|
| `waiting` | 商品画像 → NEXT DROP → 見出し → NEXT SALE 日時 → カウントダウン（スマホ1画面に収まる） |
| `imminent` | 見出しが「もうすぐ、会える。」に。カウントダウンが拡大し、色が深くなる |
| `final` | 時・分が控えめになり、**秒だけが大きく**なる。点滅ではなく、ゆっくりした呼吸のような濃淡 |
| `onsale` | 上部に販売開始バー／中央に大きな Amazon CTA／下部に固定 CTA。**リロード不要**で切り替わり、自動で最上部へ戻る |
| `soldout` | Amazon CTA を消し、「今回の販売は終了しました。」＋ 次回お知らせ CTA |

**販売開始時は、ページのどこにいても1タップで Amazon に行けます**（上部バー・ヒーローCTA・下部固定CTA）。

---

## 4. 表示しないこと（意図的な設計）

このページは Amazon の在庫・購入順を一切制御できません。そのため次の表現・演出は **実装していません**。

- 「優先購入できる」「商品を確保できる」「予約できる」「○番目に購入できる」
- 偽の在庫数・閲覧人数・購入人数・待機人数
- 架空のレビュー・架空の販売実績
- 効能効果に関する記述（提供されていない情報は一切追加していません）

代わりにファーストビューで、こう明記しています。

> このページから購入・予約・お取り置きはできません。
> 販売はAmazonの商品ページで行われます。

過去実績は `config.salesRecords` に **実際に起きた事実だけ** を入れたときだけ表示されます。
空 `[]` のあいだはセクションごと非表示です。

---

## 5. 販売開始のお知らせ（通知）

**現在は LINE 公式アカウント（`@684tcjqk`）に接続済み**です。
`config.notify.mode` で切り替えられます。

| mode | 動き |
|---|---|
| `'url'` | `url` に設定した LINE 公式・フォーム等へ遷移。**← 現在これ** |
| `'email'` | メール入力フォームを表示し、`endpoint` に `{ "email": "..." }` を POST |
| `'disabled'` | 「お知らせ機能は準備中です」と表示（押せません） |

- 販売終了（`sold_out`）にすると、このセクションの見出しとリード文が
  自動で「次回販売のお知らせを受け取る／次の販売が決まったら、お知らせします。」に切り替わります。
- どのモードでも、注意書きに「優先購入・商品の確保・予約ではありません。」と表示されます。

---

## 6. 計測

`config.analytics.ga4MeasurementId` に GA4 の測定 ID（`G-` で始まるもの）を入れるだけで接続されます。
GTM を使う場合は `window.dataLayer` に同じイベントが積まれるので、そちらを拾ってください。

| イベント | 発火タイミング |
|---|---|
| `waiting_page_view` | ページを開いたとき |
| `countdown_view` | カウントダウンが画面に入ったとき |
| `notification_click` | お知らせ CTA を押したとき |
| `sale_started` | 販売開始に切り替わったとき（`trigger` パラメータつき） |
| `amazon_click` | Amazon ボタンを押したとき（`placement`／`waited_sec` つき） |
| `sold_out_view` | 販売終了表示を見たとき |

### 見たいファネル

```
waiting_page_view                        待機ページに来た人数
        ↓
sale_started (trigger = "live")          販売開始時にもページにいた人数  ★ここが肝
        ↓
amazon_click                             Amazonを押した人数
```

- `trigger = "live"` … 販売開始の**瞬間にページを開いていた**人
- `trigger = "load"` … 販売開始**後に**ページを開いた人

この2つを分けているので、「待機 → 開始時在席 → Amazon遷移」の歩留まりがそのまま測れます。
GA4 の「探索 > ファネルデータ探索」で上の3イベントを順に並べてください。

他ツールを足したいときは `chenme:track` カスタムイベントを拾えば、コード本体を触らずに接続できます。

### GA4 の初期設定

1. https://analytics.google.com → 管理（歯車）→ **プロパティを作成**
   - 名前: `ChenMe` ／ タイムゾーン: **日本** ／ 通貨: **日本円**
2. データストリーム → **ウェブ** → 公開URLを入力して作成
3. 発行された **測定ID（`G-` で始まる）** を `config.js` の `ga4MeasurementId` に貼る

### ★カスタム定義の登録（これをやらないと画面に出ません）

GA4 はイベントの**パラメータを登録しないと、探索やレポートで選べません**。
**管理 → カスタム定義** で下の5つを登録してください。

| 登録名 | 種類 | パラメータ名 | これで見えるもの |
|---|---|---|---|
| trigger | ディメンション | `trigger` | 販売開始の瞬間にいた人か、後から来た人か |
| placement | ディメンション | `placement` | 3か所のAmazonボタンのどれが押されたか |
| method | ディメンション | `method` | お知らせCTAの経路 |
| page_state | ディメンション | `page_state` | 押したときページがどの状態だったか |
| waited_sec | **指標** | `waited_sec` | 何秒待った人がAmazonへ進んだか |

`waited_sec` だけ「指標」、残りは「ディメンション」です。
**登録前のデータには遡って適用されません。** 初回販売の前に必ず登録してください。

---

## 7. 開発・公開

```bash
npm run dev          # http://localhost:4173 でプレビュー
npm install          # 画像変換ツール（sharp）を入れる。初回だけ
npm run images       # assets/img/ の画像から .webp を生成
```

### 公開先

**Cloudflare Workers（静的アセット配信）** で公開しています。ビルドは不要です。

- 公開URL: https://chenmetaikisitu.toropicanafanta.workers.dev/
- 設定: `wrangler.toml`（公開するフォルダの指定だけ）
- 公開しないファイル: `.assetsignore`（`node_modules` / `tools` / 原本画像など）

GitHub と連携済みなので、**このブランチに push すれば自動で再デプロイ**されます。
手元から直接出したいときは `npx wrangler deploy` の1コマンドです。

### 公開URLを変えたときにやること

独自ドメインに移すなどして URL が変わったら、`index.html` の先頭にある
「▼▼ 公開URLを変えたら、ここも書き換えてください ▼▼」の**2行だけ**を書き換えます。

```html
<meta property="og:url"   content="https://.../">
<meta property="og:image" content="https://.../assets/img/og.jpg">
```

OGP（LINE や X でシェアしたときのサムネイル）は絶対URLでないと画像が出ないため、
ここだけは実際の公開URLが必要です。

反映の確認は https://developers.facebook.com/tools/debug/ に URL を貼るのが早いです。

### キャッシュについて

`_headers` に設定済みです。**`index.html` と `config.js` はキャッシュしない**ので、
販売日時や `saleStatus` の変更は保存＆デプロイ後すぐ反映されます。
画像・CSS・JS は長めにキャッシュされます。

---

## 8. スマホ UX / パフォーマンス

- iPhone Safari を最優先。`viewport-fit=cover` とセーフエリア対応済み
- タップ領域はすべて 54px 以上、フォームの文字は 16px（iOS の自動ズーム防止）
- 画像は `aspect-ratio` で先に場所を確保 → **CLS が発生しない**
- カウントダウンの数字は1桁ずつ固定幅 → 数字が変わっても横揺れしない
- ファーストビューの商品画像のみ `fetchpriority="high"`、他は `loading="lazy"`
- 販売開始時は **リロード不要**。タブを戻ったとき（`visibilitychange` / `pageshow` / `focus`）も即座に再判定
- `prefers-reduced-motion` に対応。アニメーションはフェード・ごく小さな浮遊・光のみ

---

## 9. ファイル構成

```
.
├── index.html                  ページ本体（マークアップ）
├── config.js                   ★運営が触る唯一のファイル
├── _headers                    Cloudflare Pages のキャッシュ／セキュリティ設定
├── package.json
├── assets/
│   ├── css/style.css           デザインシステム（トークン → 状態別スタイル）
│   ├── js/analytics.js         計測レイヤー（GA4 / dataLayer / カスタムイベント）
│   ├── js/app.js               状態遷移・カウントダウン・各コンポーネント
│   └── img/                    ★ブランド画像5枚の置き場所
└── tools/optimize-images.mjs   画像の WebP 変換
```
