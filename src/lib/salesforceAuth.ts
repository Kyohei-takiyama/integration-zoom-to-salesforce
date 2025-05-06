// src/lib/salesforceAuth.ts
import { getEnv } from "../config/env";
import { Connection } from "jsforce";
import axios from "axios";

let sfConnection: Connection | null = null;
let tokenExpiresAt: number | null = null;
let currentAccessToken: string | null = null;
let currentInstanceUrl: string | null = null;

const env = getEnv();

/**
 * Salesforceのアクセストークン情報
 */
export interface SalesforceTokenInfo {
  access_token: string;
  instance_url: string;
  token_type: string;
  expires_in: number;
  expires_at: number; // クライアント側で有効期限を計算するための追加情報
}

/**
 * Salesforceのアクセストークンを取得する
 * クライアントクレデンシャルフローを使用してOAuth認証を行う
 */
export async function getSalesforceToken(): Promise<SalesforceTokenInfo> {
  const currentTime = Date.now();

  // 有効なトークンがある場合は再利用（有効期限の10分前に更新）
  if (
    currentAccessToken &&
    tokenExpiresAt &&
    currentTime < tokenExpiresAt - 600000
  ) {
    return {
      access_token: currentAccessToken,
      instance_url: currentInstanceUrl!,
      token_type: "Bearer",
      expires_in: Math.floor((tokenExpiresAt - currentTime) / 1000),
      expires_at: tokenExpiresAt,
    };
  }

  console.log(
    "Getting new Salesforce access token using client credentials flow..."
  );

  try {
    // クライアントクレデンシャルフローでアクセストークンを取得
    const tokenResponse = await axios.post(
      env.SALESFORCE_BASE_URL + "/services/oauth2/token",
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.SALESFORCE_CLIENT_ID,
        client_secret: env.SALESFORCE_CLIENT_SECRET,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, instance_url, token_type, expires_in } =
      tokenResponse.data;

    // トークンの有効期限を設定（秒をミリ秒に変換）
    tokenExpiresAt = currentTime + expires_in * 1000;
    currentAccessToken = access_token;
    currentInstanceUrl = instance_url;

    return {
      access_token,
      instance_url,
      token_type,
      expires_in,
      expires_at: tokenExpiresAt,
    };
  } catch (err: any) {
    console.error("Salesforce OAuth authentication failed:", err.message);
    if (err.response) {
      console.error("Response data:", err.response.data);
    }
    throw new Error(`Salesforce OAuth authentication failed: ${err.message}`);
  }
}

/**
 * Salesforceへの接続を取得する
 * クライアントクレデンシャルフローを使用してOAuth認証を行う
 */
export async function getSalesforceConnection(): Promise<Connection> {
  try {
    // トークンを取得
    const tokenInfo = await getSalesforceToken();

    // 既存の接続がある場合は再利用
    if (sfConnection) {
      sfConnection.accessToken = tokenInfo.access_token;
      sfConnection.instanceUrl = tokenInfo.instance_url;
      return sfConnection;
    }

    console.log(
      "Establishing new Salesforce connection using client credentials flow..."
    );

    // 新しい接続を作成
    const conn = new Connection({
      instanceUrl: tokenInfo.instance_url,
      accessToken: tokenInfo.access_token,
    });

    console.log(
      "Successfully connected to Salesforce using client credentials flow."
    );
    sfConnection = conn;

    // セッション終了イベントを監視
    conn.on("sessionExpired", async () => {
      console.warn("Salesforce session expired. Will refresh on next request.");
      sfConnection = null;
    });

    return conn;
  } catch (err: any) {
    console.error("Salesforce OAuth authentication failed:", err.message);
    if (err.response) {
      console.error("Response data:", err.response.data);
    }
    throw new Error(`Salesforce OAuth authentication failed: ${err.message}`);
  }
}
