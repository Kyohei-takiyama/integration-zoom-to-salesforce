// src/index.ts
import { Hono } from "hono";
import { logger } from "hono/logger";
import { handle } from "hono/aws-lambda";
import { loadEnvironmentVariables, getEnv, AppEnv } from "./config/env"; // ★ 変更: 環境変数モジュールをインポート
import webhookRouter from "./routes/webhook";
import apiRouter from "./routes/api";

// --- アプリケーション初期化関数 ---
// 環境変数を引数として受け取るように変更
function initializeApp(env: AppEnv): Hono {
  const app = new Hono();

  // Loggerミドルウェア
  app.use("*", logger());

  // ルート定義
  app.get("/status", (c) =>
    c.text("Zoom-Salesforce Integration App is running!")
  );
  // ルーターにも env を渡す必要があれば、ここで渡すか、ルーター内で getEnv() を使う
  app.route("/webhook", webhookRouter);
  app.route("/api", apiRouter);

  // 404 Not Found
  app.notFound((c) => {
    return c.json({ message: "Not Found" }, 404);
  });

  // グローバルエラーハンドラ
  app.onError((err, c) => {
    console.error("Unhandled Application Error:", err);
    return c.json({ message: "Internal Server Error" }, 500);
  });

  console.log("Hono application initialized.");
  return app;
}

// --- メイン処理 ---
let app: Hono;
let handler: ReturnType<typeof handle>; // Lambda ハンドラの型

// 環境変数をロード (非同期)
const loadedEnv = await loadEnvironmentVariables();
// もし他のモジュールで初期化前に getEnv() が呼ばれる可能性があるなら、
// loadEnvironmentVariables が完了したことを何らかの形で通知する必要がある。
// (この構造なら index.ts が起点なので大丈夫なはず)

// Hono アプリケーションを初期化
app = initializeApp(loadedEnv);

// --- 実行環境に応じてエクスポートを決定 ---
if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
  // Lambda 環境の場合
  console.log("Running in AWS Lambda environment. Exporting handler.");
  handler = handle(app); // Lambda ハンドラを作成
  // Lambda では default export は不要、名前付きエクスポート 'handler' を使う
  // module.exports.handler = handler; // CommonJSの場合
} else {
  // ローカル環境 (Bun サーバー) の場合
  console.log(
    `Running in local environment. Starting server on port ${loadedEnv.PORT}`
  );
  // module.exports = { ... } // CommonJSの場合
}

// ★ Lambda 用の名前付きエクスポート
export { handler };

// ★ ローカル (Bun) 用のデフォルトエクスポート
//    Lambda 環境ではこれは無視される
export default {
  port: loadedEnv.PORT,
  fetch: app.fetch,
};
