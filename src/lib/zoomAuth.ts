// src/lib/zoomAuth.ts
import { env } from "../config/env";

let zoomAccessToken: string | null = null;
let tokenExpiresAt: number | null = null;

interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // 秒単位
  scope: string;
}

async function fetchNewZoomToken(): Promise<string> {
  const url = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${env.ZOOM_ACCOUNT_ID}`;
  const credentials = Buffer.from(
    `${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`
  ).toString("base64");

  console.log("Fetching new Zoom access token...");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to fetch Zoom token:", response.status, errorText);
    throw new Error(`Failed to fetch Zoom token: ${response.status}`);
  }

  const data = (await response.json()) as ZoomTokenResponse;
  zoomAccessToken = data.access_token;
  // 有効期限少し前に切れるように設定 (例: 5分前)
  tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;
  console.log("Successfully fetched new Zoom access token.");
  return zoomAccessToken;
}

export async function getZoomAccessToken(): Promise<string> {
  if (zoomAccessToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
    // console.log('Using cached Zoom access token.');
    return zoomAccessToken;
  }
  // console.log('Zoom access token expired or not found, fetching new one.');
  return await fetchNewZoomToken();
}
