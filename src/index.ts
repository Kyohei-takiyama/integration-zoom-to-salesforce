// src/index.ts
import { Hono } from "hono";
import { logger } from "hono/logger";
import { env } from "./config/env";
import webhookRouter from "./routes/webhook";
import apiRouter from "./routes/api";

const app = new Hono();

// Loggerミドルウェア
app.use("*", logger());

// ルート定義
app.get("/status", (c) =>
  c.text("Zoom-Salesforce Integration App is running!")
);
app.route("/webhook", webhookRouter); // /webhook プレフィックスで webhookRouter を適用
app.route("/api", apiRouter); // /api プレフィックスで apiRouter を適用

// 404 Not Found
app.notFound((c) => {
  return c.json({ message: "Not Found" }, 404);
});

// グローバルエラーハンドラ
app.onError((err, c) => {
  console.error("Unhandled Application Error:", err);
  // ここでエラーの種類に応じてログレベルを変えたり、外部監視サービスに通知したりできる
  // if (err instanceof SpecificKnownError) { ... }
  return c.json({ message: "Internal Server Error" }, 500);
});

console.log(`Server listening on port ${env.PORT}`);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
