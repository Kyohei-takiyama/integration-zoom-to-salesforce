// src/config/env.ts
import { z } from "zod";
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";
import path from "path"; // .env ファイルのパス解決用 (ローカル用)
import fs from "fs"; // .env ファイル読み込み用 (ローカル用)

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"), // 環境識別用
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
  SALESFORCE_OPPORTUNITY_ID_REGEX: z
    .string()
    .default("^\\[Opp-([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})\\]"),
  SALESFORCE_EVENT_SUBJECT_PREFIX: z.string().default("[Zoom録画] "),
  SALESFORCE_EVENT_DESCRIPTION_TEMPLATE: z
    .string()
    .default(
      "Zoom録画が完了しました。\n録画リンク: {{recordingUrl}}\n\n文字起こし:\n{{transcript}}\n\nミーティングサマリー:\n{{meetingSummary}}"
    ),
  SALESFORCE_EVENT_DURATION_MINUTES: z.coerce.number().default(60),
  SALESFORCE_EVENT_ZOOM_UUID_FIELD: z.string().default("ZoomMeetingId__c"),
  SALESFORCE_EVENT_MEETING_SUMMARY_FIELD: z
    .string()
    .default("Description")
    .optional(),
});

// --- SSM パラメータストア設定 ---
const ssmParameterPrefix =
  process.env.SSM_PARAMETER_PREFIX ||
  `/zoom-salesforce-integration/${process.env.NODE_ENV || "dev"}/`;

// SSMから取得するパラメータ名をキー、envSchemaのキーを値とするマッピング
const ssmParameterMapping: { [key: string]: keyof z.infer<typeof envSchema> } =
  {
    ZoomWebhookSecretToken: "ZOOM_WEBHOOK_SECRET_TOKEN",
    ZoomAccountId: "ZOOM_ACCOUNT_ID",
    ZoomClientId: "ZOOM_CLIENT_ID",
    ZoomClientSecret: "ZOOM_CLIENT_SECRET",
    SalesforceBaseUrl: "SALESFORCE_BASE_URL",
    SalesforceClientId: "SALESFORCE_CLIENT_ID",
    SalesforceClientSecret: "SALESFORCE_CLIENT_SECRET",
    SalesforceOpportunityIdRegex: "SALESFORCE_OPPORTUNITY_ID_REGEX",
    SalesforceEventSubjectPrefix: "SALESFORCE_EVENT_SUBJECT_PREFIX",
    SalesforceEventDescriptionTemplate: "SALESFORCE_EVENT_DESCRIPTION_TEMPLATE",
    SalesforceEventDurationMinutes: "SALESFORCE_EVENT_DURATION_MINUTES",
    SalesforceEventZoomUuidField: "SALESFORCE_EVENT_ZOOM_UUID_FIELD",
    SalesforceEventMeetingSummaryField:
      "SALESFORCE_EVENT_MEETING_SUMMARY_FIELD",
  };

// --- 環境変数を保持する変数 ---
// z.infer でスキーマから型を推論
let loadedEnv: z.infer<typeof envSchema>;
let isEnvLoaded = false;

// --- .env ファイル読み込み関数 (ローカル開発用) ---
function loadEnvFromFile(filePath: string): Record<string, string> {
  const envVars: Record<string, string> = {};
  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, { encoding: "utf8" });
    fileContent.split("\n").forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith("#")) {
        const [key, ...valueParts] = trimmedLine.split("=");
        const value = valueParts.join("=").trim();
        // Remove surrounding quotes if any
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          envVars[key.trim()] = value.slice(1, -1);
        } else {
          envVars[key.trim()] = value;
        }
      }
    });
  }
  return envVars;
}

// --- 環境変数をロードする非同期関数 ---
async function loadEnvironmentVariables(): Promise<z.infer<typeof envSchema>> {
  if (isEnvLoaded) {
    return loadedEnv;
  }

  console.log("Loading environment variables...");
  const rawEnv: { [key: string]: any } = { ...process.env }; // process.env をコピー

  // ローカル開発時 (.env ファイルを優先的に読み込む例)
  if (process.env.NODE_ENV === "dev" || !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const envFilePath = path.resolve(process.cwd(), ".env");
    console.log(`Attempting to load .env file from: ${envFilePath}`);
    const fileEnv = loadEnvFromFile(envFilePath);
    // process.env よりも .env ファイルの内容を優先する場合
    Object.assign(rawEnv, fileEnv);
    console.log(
      `.env file loaded: ${Object.keys(fileEnv).length} variables found.`
    );
  }

  // SSM パラメータストアから取得 (Lambda環境またはSSMプレフィックスが設定されている場合)
  const ssmParamNamesToFetch = Object.keys(ssmParameterMapping).map(
    (name) => `${ssmParameterPrefix}${name}`
  );

  if (
    ssmParamNamesToFetch.length > 0 &&
    (process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LOAD_FROM_SSM === "true")
  ) {
    console.log(
      `Fetching parameters from SSM path prefix: ${ssmParameterPrefix}`
    );
    try {
      const ssmClient = new SSMClient({}); // リージョンは自動 or 環境変数 AWS_REGION から取得
      const command = new GetParametersCommand({
        Names: ssmParamNamesToFetch,
        WithDecryption: true,
      });
      const response = await ssmClient.send(command);

      if (response.Parameters && response.Parameters.length > 0) {
        console.log(
          `Successfully fetched ${response.Parameters.length} parameters from SSM.`
        );
        response.Parameters.forEach((param) => {
          const paramNameWithoutPrefix = param.Name?.replace(
            ssmParameterPrefix,
            ""
          );
          if (
            paramNameWithoutPrefix &&
            ssmParameterMapping[paramNameWithoutPrefix]
          ) {
            const envKey = ssmParameterMapping[paramNameWithoutPrefix];
            // process.env や .env よりも SSM の値を優先
            rawEnv[envKey] = param.Value;
            console.log(`  ${param.Name} -> ${envKey} (loaded from SSM)`);
          }
        });
      }

      if (response.InvalidParameters && response.InvalidParameters.length > 0) {
        console.warn(
          `Could not find the following parameters in SSM: ${response.InvalidParameters.join(
            ", "
          )}`
        );
        // 必要に応じてエラー処理を追加 (例: 特定のパラメータが見つからない場合はエラーにする)
      }
    } catch (error) {
      console.error("Failed to fetch parameters from SSM:", error);
      // SSMからの取得に失敗した場合のフォールバック処理 or エラーハンドリング
      // ここでは警告のみ出力し、process.env や .env の値で続行する
    }
  } else {
    console.log("Skipping SSM parameter fetch.");
  }

  try {
    // 環境変数を Zod スキーマでパース＆検証
    loadedEnv = envSchema.parse(rawEnv);
    isEnvLoaded = true;
    console.log("Environment variables loaded and validated successfully.");

    // デバッグ用に読み込まれた値の一部を表示 (シークレットは除く)
    console.log("  NODE_ENV:", loadedEnv.NODE_ENV);
    console.log("  PORT:", loadedEnv.PORT);
    console.log("  SALESFORCE_BASE_URL:", loadedEnv.SALESFORCE_BASE_URL);
    // console.log("Loaded Env Object:", loadedEnv); // 全て表示したい場合

    // 正規表現の検証 (以前のコードから移動)
    new RegExp(loadedEnv.SALESFORCE_OPPORTUNITY_ID_REGEX);
    console.log("Salesforce Opportunity ID Regex is valid.");

    return loadedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Environment variable validation failed:", error.format());
    } else {
      console.error(
        "An unexpected error occurred during environment variable loading:",
        error
      );
    }
    // 正規表現エラーの場合
    if (
      error instanceof Error &&
      error.message.includes("Invalid regular expression")
    ) {
      console.error(
        "Invalid Salesforce Opportunity ID Regex:",
        rawEnv.SALESFORCE_OPPORTUNITY_ID_REGEX,
        error
      );
    }
    process.exit(1); // エラーがあれば起動を停止
  }
}

// --- モジュールとしてロードされたときに環境変数を読み込む ---
// トップレベル await を使うか、使う側で呼ぶか、IIFEを使う
// ここでは、使う側 (index.ts) で最初に呼び出すことを想定し、関数と状態をエクスポート
export { loadEnvironmentVariables, isEnvLoaded };
// 読み込み済みの環境変数を直接参照したい場合は loadedEnv もエクスポート (ただし初期は undefined)
export type AppEnv = z.infer<typeof envSchema>;
export function getEnv(): AppEnv {
  if (!isEnvLoaded) {
    throw new Error(
      "Environment variables have not been loaded yet. Call loadEnvironmentVariables() first."
    );
  }
  return loadedEnv;
}
