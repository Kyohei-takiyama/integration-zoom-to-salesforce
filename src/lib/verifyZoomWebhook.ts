// src/lib/verifyZoomWebhook.ts
import { Context } from "hono";
import { env } from "../config/env";
import crypto from "crypto";

/**
 * Zoom Webhookリクエストの署名を検証するミドルウェア
 */
export const verifyZoomWebhook = async (
  c: Context<any, any, {}>,
  next: Function
) => {
  const signature = c.req.header("x-zm-signature");
  const timestamp = c.req.header("x-zm-request-timestamp");
  const body = await c.req.text(); // 生のリクエストボディを取得

  console.log("Received Zoom Webhook request:", {
    signature,
    timestamp,
    body,
  });

  if (!signature || !timestamp) {
    console.warn("Missing Zoom signature or timestamp header");
    return c.json({ message: "Missing signature headers" }, 401);
  }

  // タイムスタンプが古すぎる場合は拒否 (例: 5分以上前)
  const now = Math.floor(Date.now() / 1000);
  if (now - parseInt(timestamp, 10) > 300) {
    console.warn("Zoom webhook timestamp is too old");
    return c.json({ message: "Timestamp validation failed" }, 401);
  }

  const message = `v0:${timestamp}:${body}`;
  const hash = crypto
    .createHmac("sha256", env.ZOOM_WEBHOOK_SECRET_TOKEN)
    .update(message)
    .digest("hex");
  const expectedSignature = `v0=${hash}`;

  if (signature !== expectedSignature) {
    console.error("Invalid Zoom webhook signature");
    console.log("Received:", signature);
    console.log("Expected:", expectedSignature);
    return c.json({ message: "Invalid signature" }, 401);
  }

  // 検証成功、リクエストボディをパースしてコンテキストに設定
  try {
    c.set("parsedBody", JSON.parse(body));
  } catch (error) {
    console.error("Failed to parse webhook body:", error);
    return c.json({ message: "Invalid request body" }, 400);
  }

  await next();
};

/**
 * Zoom Webhookの初回URL検証リクエストに対応する関数
 * @param payload Webhookペイロード
 * @returns 検証レスポンス or null
 */
export const handleZoomWebhookValidation = (
  payload: any
): { plainToken: string; encryptedToken: string } | null => {
  console.log("Handling Zoom webhook validation:", payload);
  if (
    payload?.event === "endpoint.url_validation" &&
    payload?.payload?.plainToken
  ) {
    console.log("Received Zoom endpoint URL validation request.");
    const plainToken = payload.payload.plainToken;
    const hashForValidate = crypto
      .createHmac("sha256", env.ZOOM_WEBHOOK_SECRET_TOKEN)
      .update(plainToken)
      .digest("hex");

    const response = {
      plainToken: plainToken,
      encryptedToken: hashForValidate,
    };
    console.log("Responding to Zoom validation:", response);
    return response;
  }
  return null;
};
