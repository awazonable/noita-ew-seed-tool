# noita-ew-seed-tool — CLAUDE.md

このファイルは Claude Code への指示書です。作業開始前に必ず読んでください。

---

## プロジェクト概要

Noita の **Entangled Worlds (EW)** 環境下でのパーク生成アルゴリズムを再現する静的 Web アプリ。

- **入力:** World Seed（uint32）、SteamID64（16進数文字列）
- **出力:** 各 Mountain（聖なる山）で選ばれるパーク一覧
- **ホスト:** GitHub Pages（静的ファイルのみ、サーバー不要）

---

## 実装すべきアルゴリズム

### Step 1: 座標オフセット（sx, sy）の算出

SteamID64 の文字列から以下の規則でオフセットを計算する。

```
sx = parseInt(steamId.substring(7, 12), 16)   // 8文字目から5文字（0-indexed: 7..11）
sy = parseInt(steamId.substring(11, 16), 16)  // 12文字目から末尾（0-indexed: 11..15）
// 注: Lua の string.sub は1オリジン・両端含む
// Lua: string.sub(id, 8, 12) → JS: id.substring(7, 12)
// Lua: string.sub(id, 12)    → JS: id.substring(11)
```

### Step 2: 乱数エンジン（LCG）の初期化

IEEE 754 準拠の double ビット演算で実装する。

```javascript
// グローバル状態
let _world_seed = 0;
let _rng_seed_x = 0;
let _rng_seed_y = 0;

function SetRandomSeedHelper(a, b) {
  // float64 → uint32 ビットキャスト（下位32ビット）
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setFloat64(0, a, true);
  const ax = view.getUint32(0, true);
  view.setFloat64(0, b, true);
  const bx = view.getUint32(0, true);
  _rng_seed_x = ax ^ (_world_seed >> 13);
  _rng_seed_y = bx;
}

function SetRandomSeed(x, y) {
  _world_seed = /* 引数から算出 */ ...;  // 実装を参照
  SetRandomSeedHelper(x, y);
  // ws & 3 回 Next() を空回しすること（重要）
  const ws = _world_seed;
  for (let i = 0; i < (ws & 3); i++) Next();
}

function Next() {
  // LCG: 実際の Noita 実装に合わせること
  _rng_seed_x = 214013 * _rng_seed_x + 2531011;
  _rng_seed_y = 17405 * _rng_seed_y + 10395331;
  return ((_rng_seed_x ^ _rng_seed_y) >>> 0) & 0x7FFF;
}
```

**重要:** `ws & 3` 回の空回しを省略するとデッキ先頭がズレる。

### Step 3: パークプールの構築

`perk_list.lua` からパークデータを移植し、`not_in_default_perk_pool == false` のもののみを抽出して配列化する（定義順を維持すること）。

### Step 4: デッキ生成

EW でのシード設定:
```
SetRandomSeed(1.0 + sx, 2.0 + sy)
```
（バニラとの差分: 座標引数が sx/sy ベースになる）

1. `Next() % pool.length` でインデックスを取得
2. 選択したパークをプールから除外
3. 全パーク分繰り返して固定配列を作成

---

## 技術スタック

- **純粋な HTML + JavaScript**（フレームワーク不要）
- GitHub Pages で動く静的ファイルのみ
- ビルド不要・依存ライブラリなし

---

## ファイル構成（目標）

```
/
├── index.html          # UI（入力フォーム + 結果表示）
├── perk-calculator.js  # アルゴリズム実装
├── perk-data.js        # perk_list.lua から移植したパークデータ
└── specs/              # 仕様書・参考資料
```

---

## 開発ルール

- issue の内容を正確に実装すること
- テストを書き、すべて通過させること（`make test` で実行できるようにすること）
- PR を作成する前に `git diff main` で差分を確認すること
- PR タイトルは `fix: #<issue番号> <内容>` の形式にすること

## ブランチ・CI規約

- featureブランチはmainに向けてPRを作成すること
- mainへの直接pushは絶対に禁止
- テストを変更・削除・スキップすることを禁止する
- PRを作成する前にローカルでテストが通ることを確認すること

## ブランチ名規則

`feature/<issue番号>-<内容を英語で表した30文字以内のkebab-case>`

## デプロイ

main ブランチへのマージ後、GitHub Pages が自動デプロイする（`gh-pages` ブランチまたは `docs/` ディレクトリを使用）。

ローカル確認:
```bash
python3 -m http.server 8100
# http://localhost:8100 で確認
```

## セキュリティ

このリポジトリは **Public** です。`claude` ラベルの付与は CI ワークフローで所有者のみに制限されています。外部コントリビューターは直接 Claude への指示を行えません。

## ポート（ローカル開発用）

| 用途 | ポート |
|------|--------|
| ローカル HTTP サーバ | 8101 |
