# Vd-Pad-Backend 改善ロードマップ

## はじめに (Introduction)

このドキュメントは、`src/index.ts` に実装されている「URLからの記事本文抽出API」の仮実装を、本番運用可能な品質に向上させるためのリファクタリング計画書です。

**背景:**
*   **目的:** 現在の「仮実装」を、堅牢性・セキュリティ・保守性を確保した「本実装」に移行します。
*   **現状のコード:** `src/index.ts` に、単一ファイルですべてのロジックが実装されています。
*   **現状の技術スタック:** `Hono`, `node-fetch`, `@mozilla/readability`, `jsdom`, `chardet`, `iconv-lite`, `cheerio` 等が利用されています。
*   **アーキテクチャ:** ユーザーからの指示に基づき、**オニオンアーキテクチャ**を採用してリファクタリングを進めます。

このロードマップに記載された各Issueは、上記の文脈を前提としています。

---

## 改善ロードマップ

### Phase 1: 基盤整備
1.  アプリケーションの骨格となるオニオンアーキテクチャのディレクトリ構造を構築します。
2.  設定やロギングといった、アプリケーション全体に関わる横断的な関心事を整備します。

### Phase 2: コアロジックのリファクタリング
1.  既存のロジックを新しいアーキテクチャに沿って分割・再配置します。
2.  この過程で、パフォーマンスの問題（二重パース）も解消します。

### Phase 3: セキュリティと堅牢性の強化
1.  リファクタリングされたコードベースに対して、エラーハンドリングの改善やセキュリティ対策を層として追加していきます。

---

## オニオンアーキテクチャのディレクトリ構造案

`src` 以下に作成するディレクトリ構造案です。

```
src/
├── domain/
│   ├── models/         # Article, Url などのドメインオブジェクト
│   └── repositories/   # データアクセス層のインターフェース定義
├── usecases/
│   └── ImportScriptUseCase.ts # アプリケーションのユースケース
├── infrastructure/
│   ├── services/       # 外部ライブラリ(fetch, JSDOM)の実装
│   └── logging/        # ロガーの実装
├── interfaces/
│   ├── controllers/    # HonoのルーティングとHTTPリクエスト/レスポンス処理
│   ├── middlewares/    # エラーハンドリング、レートリミット等
│   └── presentation/   # レスポンスとして返すデータ構造(DTO)
├── config/
│   └── index.ts        # 環境変数などの設定管理
└── main.ts             # DIコンテナの設定とサーバー起動
```

---

## Issueリスト（タスク一覧）

### Phase 1: 基盤整備

*   **Issue #1: プロジェクト構造をオニオンアーキテクチャへ移行**
    *   **Title:** `Feat: Migrate project structure to Onion Architecture`
    *   **Description:**
        *   `domain`, `usecases`, `infrastructure`, `interfaces`, `config` のディレクトリを作成する。
        *   既存のロジックは、一旦 `interfaces/controllers` に移動させる。
        *   エントリーポイントを `src/main.ts` に作成し、サーバー起動処理を移管する。

*   **Issue #2: 設定値の外部化**
    *   **Title:** `Feat: Externalize configuration using environment variables`
    *   **Description:**
        *   `dotenv` を導入し、`.env` ファイルで設定を管理できるようにする。
        *   ポート番号、フェッチのタイムアウト、コンテンツの最大サイズなどを環境変数から読み込むように `src/config` を実装する。

*   **Issue #3: 構造化ロギングの導入**
    *   **Title:** `Feat: Introduce structured logging (e.g., Pino)`
    *   **Description:**
        *   `pino` などのロギングライブラリを導入する。
        *   `console.log` をロガーに置き換え、リクエストIDなどをログに含めることでトレーサビリティを向上させる。

### Phase 2: コアロジックのリファクタリング

*   **Issue #4: 記事インポート処理のリファクタリング**
    *   **Title:** `Refactor: Decompose import logic into UseCase and Services`
    *   **Description:**
        *   `interfaces/controllers` にある巨大な関数を `ImportScriptUseCase` に分割する。
        *   URL検証、DNS解決、コンテンツ取得、記事抽出などの具体的な処理を `infrastructure/services` に切り出す。
        *   **このIssueでパフォーマンス改善（HTMLの二重パース解消）も同時に行う。**

### Phase 3: セキュリティと堅牢性の強化

*   **Issue #5: エラーハンドリング機構の改善**
    *   **Title:** `Refactor: Implement a centralized error handling middleware`
    *   **Description:**
        *   カスタムエラークラス（`ValidationError`, `NetworkError`など）を定義する。
        *   Honoのミドルウェアとして、エラーを一元的に補足し、適切なHTTPステータスと整形されたJSONを返す機構を実装する。

*   **Issue #6: SSRF対策の強化（リダイレクト対応）**
    *   **Title:** `Security: Enhance SSRF protection by handling redirects safely`
    *   **Description:**
        *   `infrastructure` 層のHTTPクライアントを修正し、リダイレクトを追跡しつつ、リダイレクト先のIPアドレスも検証するロジックを追加する。
        *   無限リダイレクトを防ぐため、リダイレクト回数に上限を設ける。

*   **Issue #7: DoS対策（レートリミット導入）**
    *   **Title:** `Security: Implement rate limiting to prevent DoS attacks`
    *   **Description:**
        *   `hono/ratelimiter` などのミドルウェアを利用し、`/import-script` エンドポイントにIPアドレスベースのレートリミットを導入する。
