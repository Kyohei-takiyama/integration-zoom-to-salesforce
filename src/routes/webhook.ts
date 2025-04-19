// src/routes/webhook.ts
import { Hono } from "hono";
import { verifyZoomWebhook } from "../lib/verifyZoomWebhook";
import { handleZoomWebhook } from "../handlers/zoomWebhookHandler";

const webhookRouter = new Hono();

// ZoomからのWebhookを受け取るエンドポイント
// POSTリクエストを想定
// verifyZoomWebhook ミドルウェアで署名を検証
webhookRouter.post("/zoom", verifyZoomWebhook, handleZoomWebhook);

export default webhookRouter;
