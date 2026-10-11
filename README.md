# デカウス空間ビューア

> ### ▶ [ブラウザで開く：https://kazm00th.github.io/decaus/](https://kazm00th.github.io/decaus/)
>
> インストール不要。リンクを開くだけで使えます。

実係数の多項式 y = f(x) について、x を複素数に広げたときに y が実数になる点の集合
（デカウス曲線）を、3次元空間（Re x, Im x, y）に描いて回して見るアプリです。

出典：加藤「思索の散歩道 — デカウス空間」 https://kato.chobi.net/descaus/index.html

## 使い方

`index.html` をブラウザで開く（サーバ不要、外部ライブラリなし）。

- プリセットか、次数と係数（数値欄・スライダー）で多項式を決める。
- ドラッグで回転、ホイールで拡大縮小。「真上」「真横」「斜め」で視点を切り替える。
- 実曲線は黒、虚曲線は色付き。真上から見て（ガウス平面に落として）一本につながる曲線は同じ色。
- 臨界点が重なる退化点では「通り抜けの規則」で色を付ける。係数を少し動かすと色の組み合わせが変わることがある（仕様）。

## テスト

Node.js 18 以上で実行します（依存パッケージなし）。

    node --test tests/core.test.js

## 文書

- 設計書：`docs/superpowers/specs/2026-10-11-decaus-viewer-design.md`
- 実装計画：`docs/superpowers/plans/2026-10-11-decaus-viewer.md`
- 進み具合と決定事項：`HANDOFF.md`
