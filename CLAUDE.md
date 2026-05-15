# noita-ew-seed-tool — CLAUDE.md

このファイルは Claude Code への指示書です。作業開始前に必ず読んでください。

---

## プロジェクト概要

Noita の **Entangled Worlds (EW)** 環境下でのパーク生成アルゴリズムを再現する静的 Web アプリ。

- **入力:** World Seed（uint32）、SteamID64（10進数文字列）
- **出力:** 各 Holy Mountain（聖なる山）で選ばれるパーク一覧
- **ホスト:** GitHub Pages（静的ファイルのみ、サーバー不要）

---

## 実装済みアルゴリズム

> **注意:** 以下は issue #10 / #11 で確定した正確な実装の記録です。
> 古い dual-LCG 実装や selection shuffle は**誤りであり廃止済み**です。

### Step 1: 座標オフセット（sx, sy）の算出

SteamID64（10進数文字列）を16進数に変換してから以下の規則でオフセットを計算する。

```javascript
// decimal SteamID64 → 16桁 hex
const hex = BigInt(steamId).toString(16).padStart(16, '0');

// Lua: string.sub(id, 8, 12) → JS: hex.slice(7, 12)
// Lua: string.sub(id, 12)    → JS: hex.slice(11)
const sx = parseInt(hex.slice(7, 12), 16) || 0;
const sy = parseInt(hex.slice(11), 16) || 0;
```

### Step 2: PRNG — rng.wasm（Nolla PRNG）

**自前実装は使わない。** TwoAbove/noita-tools の `rng.wasm`（MIT ライセンス）を借用する。

```javascript
async function initWasm() {
  const response = await fetch('./rng.wasm');
  const wasmBytes = await response.arrayBuffer();
  const result = await WebAssembly.instantiate(wasmBytes, {});
  _wasm = result.instance.exports;
  // exports: SetWorldSeed(uint32), SetRandomSeed(float64, float64), RandomInt(int, int)
}
```

PRNG は Nolla PRNG（Bob Jenkins ハッシュ + Park-Miller LCG）。
Node.js 環境では `fs.readFileSync` でバイナリを読む（テスト用）。

### Step 3: シード設定

```javascript
SetWorldSeed(worldSeed >>> 0);
SetRandomSeed(1.0 + sx, 2.0 + sy);
```

EW はバニラと同じ `perk_get_spawn_order` を呼ぶが、シード引数が `sx/sy` ベースになる。

### Step 4: プール構成（103パーク）

`not_in_default_perk_pool` のパークのみ除外: **MOON_RADAR, MAP, LEGGY_FEET**

**SAVING_GRACE と RESPAWN は除外しない。** EW の `hide_perk()` は UI 表示を隠すだけでプール構成には影響しない。

各パークの処理（noita-tools `perk_get_spawn_order` 準拠）:

```javascript
for each perk in PERK_POOL:
  if not perk.stackable:
    deck.push(perk.id)                      // 非スタッカブル: 1個、乱数消費なし
  else:
    max_perks = RandomInt(1, 2)             // 常に消費
    if perk.maxPool:
      max_perks = RandomInt(1, perk.maxPool) // maxPool があれば上書き
    if perk.rare:
      max_perks = 1                          // rare は強制1個（追加 Random なし）
    how_many = RandomInt(1, max_perks)       // 常に消費
    for j in range(how_many): deck.push(perk.id)
```

`perk-data.js` の各エントリは `{ id, name, stackable, rare, maxPool }` を持つ。

### Step 5: Fisher-Yates シャッフル

```javascript
for i = deck.length - 1 down to 1:
  j = RandomInt(0, i)
  swap(deck[i], deck[j])
```

### Step 6: 重複除去（MIN_DIST = 4）

後方から走査し、スタッカブルパークが直前4ポジション以内に重複していれば削除する。

```javascript
for i = deck.length - 1 down to 0:
  if not perk.stackable: continue
  for ri in [i-4, i):
    if ri >= 0 and deck[ri] === deck[i]:
      deck.splice(i, 1); break
```

---

## ゲーム実機確認済みの回帰値

SteamID64: `76561198208852417`（sx=69329, sy=74177）

| World Seed | HM1 Perk 1 | HM1 Perk 2 | HM1 Perk 3 |
|---|---|---|---|
| 3280915446 | Invisibility | No Wand Tinkering | Teleportitis Dodge |
| 11111111 | Stainless Armour | Explosion Immunity | Extra Item In Holy Mountain |
| 12345678 | Revenge Explosion | No More Shuffle | No Wand Tinkering |

これらは `tests/perk.test.js` の game-verified テストケースとして維持されている。

---

## 技術スタック

- **HTML + JavaScript**（フレームワーク不要）
- **`rng.wasm`**: TwoAbove/noita-tools より借用（MIT ライセンス）— PRNG 実装
- GitHub Pages で動く静的ファイルのみ
- ビルド不要

---

## ファイル構成

```
/
├── index.html          # UI（パーク一覧 + シード検索タブ）
├── perk-calculator.js  # アルゴリズム実装（WASM ラッパー）
├── perk-data.js        # 103パーク定義（stackable/rare/maxPool 付き）
├── rng.wasm            # TwoAbove/noita-tools より借用（MIT）
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
python3 -m http.server 8101
# http://localhost:8101 で確認
```

## セキュリティ

このリポジトリは **Public** です。`claude` ラベルの付与は CI ワークフローで所有者のみに制限されています。外部コントリビューターは直接 Claude への指示を行えません。

## ポート（ローカル開発用）

| 用途 | ポート |
|------|--------|
| ローカル HTTP サーバ | 8101 |
