// src/lib/salesforceAuth.ts
import { env } from "../config/env";
import { Connection } from "jsforce";

let sfConnection: Connection | null = null;

export async function getSalesforceConnection(): Promise<Connection> {
  if (sfConnection && sfConnection.accessToken) {
    // TODO: トークンの有効期限をチェックするロジックを追加する方が堅牢
    // console.log('Using cached Salesforce connection.');
    return sfConnection;
  }

  console.log("Establishing new Salesforce connection...");
  const conn = new Connection({
    loginUrl: env.SALESFORCE_LOGIN_URL,
  });

  try {
    await conn.login(env.SALESFORCE_USERNAME, env.SALESFORCE_PASSWORD);
    console.log("Successfully connected to Salesforce.");
    sfConnection = conn; // キャッシュする
    // セッション終了イベントを監視 (必要に応じて再接続など)
    conn.on("sessionExpired", async () => {
      console.warn("Salesforce session expired. Attempting to re-login.");
      sfConnection = null; // キャッシュをクリア
      // 必要であればここで自動再ログイン処理を実装
    });
    return conn;
  } catch (err: any) {
    console.error("Salesforce login failed:", err.message);
    throw new Error(`Salesforce login failed: ${err.message}`);
  }
}
