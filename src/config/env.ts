// src/config/env.ts
import { z } from "zod";

// Bun v1.1+ は自動で .env を読む
// import dotenv from 'dotenv';
// dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  // Zoom
  ZOOM_WEBHOOK_SECRET_TOKEN: z.string().min(1),
  ZOOM_ACCOUNT_ID: z.string().min(1),
  ZOOM_CLIENT_ID: z.string().min(1),
  ZOOM_CLIENT_SECRET: z.string().min(1),
  // Salesforce
  SALESFORCE_LOGIN_URL: z
    .string()
    .url()
    .default("https://login.salesforce.com"),
  SALESFORCE_CLIENT_ID: z.string().min(1),
  SALESFORCE_CLIENT_SECRET: z.string().min(1),
  SALESFORCE_USERNAME: z.string().min(1),
  SALESFORCE_PASSWORD: z.string().min(1), // パスワード + セキュリティトークン
  // アプリケーション固有設定
  SALESFORCE_ZOOM_UUID_FIELD: z.string().default("ZoomMeetingUUID__c"), // SF EventのZoom UUIDカスタム項目名
  SALESFORCE_RECORDING_URL_FIELD: z.string().default("ZoomRecordingURL__c"), // SF Eventの録画URLカスタム項目名
  SALESFORCE_TRANSCRIPT_FIELD: z.string().optional(), // SF Eventのトランスクリプト項目名 (任意)
});

export const env = envSchema.parse(process.env);

console.log("Environment variables loaded successfully.");
