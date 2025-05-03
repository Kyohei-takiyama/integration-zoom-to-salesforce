// src/config/env.ts
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  // Zoom
  ZOOM_WEBHOOK_SECRET_TOKEN: z.string().min(1),
  ZOOM_ACCOUNT_ID: z.string().min(1),
  ZOOM_CLIENT_ID: z.string().min(1),
  ZOOM_CLIENT_SECRET: z.string().min(1),
  // Salesforce
  SALESFORCE_BASE_URL: z.string().url().default("https://login.salesforce.com"),
  SALESFORCE_CLIENT_ID: z.string().min(1),
  SALESFORCE_CLIENT_SECRET: z.string().min(1),

  // --- Application Specific Settings ---
  // Regular expression to extract Salesforce Opportunity ID from Zoom meeting topic
  // Example: Matches "[Opp-006...]" and captures the 15 or 18 character ID
  SALESFORCE_OPPORTUNITY_ID_REGEX: z
    .string()
    .default("^\\[Opp-([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})\\]"), // 正規表現を調整してください

  // Salesforce Event fields for the new event
  SALESFORCE_EVENT_SUBJECT_PREFIX: z.string().default("[Zoom録画] "), // 新規Event件名の接頭辞
  SALESFORCE_EVENT_DESCRIPTION_TEMPLATE: z
    .string()
    .default(
      "Zoom録画が完了しました。\n録画リンク: {{recordingUrl}}\n\n文字起こし:\n{{transcript}}\n\nミーティングサマリー:\n{{meetingSummary}}"
    ), // 説明テンプレート
  SALESFORCE_EVENT_DURATION_MINUTES: z.coerce.number().default(60), // Zoomのdurationがない場合のデフォルト時間（分）

  // Custom field on Salesforce Event to store Zoom Meeting UUID (for deduplication)
  SALESFORCE_EVENT_ZOOM_UUID_FIELD: z.string().default("ZoomMeetingId__c"), // EventのZoom UUIDカスタム項目名

  // Custom field on Salesforce Event to store Zoom Meeting Summary
  SALESFORCE_EVENT_MEETING_SUMMARY_FIELD: z
    .string()
    .default("Description")
    .optional(), // EventのミーティングサマリーはEvent.Descriptionに保存
});

export const env = envSchema.parse(process.env);

console.log("Environment variables loaded successfully.");
// 正規表現のテスト用（開発時）
try {
  new RegExp(env.SALESFORCE_OPPORTUNITY_ID_REGEX);
  console.log("Salesforce Opportunity ID Regex is valid.");
} catch (e) {
  console.error(
    "Invalid Salesforce Opportunity ID Regex in .env:",
    env.SALESFORCE_OPPORTUNITY_ID_REGEX,
    e
  );
  process.exit(1); // エラーがあれば起動を停止
}
