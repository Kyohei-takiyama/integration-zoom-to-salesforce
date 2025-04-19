// src/services/zoomService.ts
import { getZoomAccessToken } from "../lib/zoomAuth";

const ZOOM_API_BASE_URL = "https://api.zoom.us/v2";

/**
 * 指定されたURLからデータをダウンロードする (認証付き)
 * @param downloadUrl ダウンロードURL
 * @param tokenType 'jwt' or 'oauth'
 */
async function downloadWithAuth(
  downloadUrl: string,
  tokenType: "oauth" = "oauth"
): Promise<Response> {
  const accessToken = await getZoomAccessToken(); // OAuthトークンを取得

  // download_urlにアクセストークンを付与してアクセス
  const urlWithToken = `${downloadUrl}${
    downloadUrl.includes("?") ? "&" : "?"
  }access_token=${accessToken}`;

  const response = await fetch(urlWithToken, {
    method: "GET",
    headers: {
      // OAuthトークンを使う場合、通常Authorizationヘッダーは不要だが念のため
      // 'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `Failed to download from ${downloadUrl}:`,
      response.status,
      errorText
    );
    throw new Error(`Failed to download resource: ${response.status}`);
  }
  return response;
}

/**
 * ミーティングの録画詳細情報を取得する
 * @param meetingUuid ミーティングUUID
 */
export async function getMeetingRecordings(meetingUuid: string): Promise<any> {
  const accessToken = await getZoomAccessToken();
  const url = `${ZOOM_API_BASE_URL}/meetings/${meetingUuid}/recordings`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `Failed to get recordings for meeting ${meetingUuid}:`,
      response.status,
      errorText
    );
    throw new Error(`Failed to get recordings: ${response.status}`);
  }
  return await response.json();
}

/**
 * トランスクリプトファイルをダウンロードしてテキストを取得する
 * @param transcriptDownloadUrl トランスクリプト(VTT)のダウンロードURL
 */
export async function downloadTranscriptText(
  transcriptDownloadUrl: string
): Promise<string> {
  console.log(`Downloading transcript from: ${transcriptDownloadUrl}`);
  const response = await downloadWithAuth(transcriptDownloadUrl);
  const vttContent = await response.text();

  // VTT形式からテキスト部分のみを抽出する簡単な処理
  const lines = vttContent.split("\n");
  let transcriptText = "";
  let isTextSection = false;
  for (const line of lines) {
    if (line.includes("-->")) {
      // タイムスタンプ行
      isTextSection = true;
    } else if (line.trim() === "" && isTextSection) {
      // テキスト後の空行
      isTextSection = false;
    } else if (isTextSection) {
      // テキスト行
      // WEBVTTヘッダーやNOTEなどを除外 (より厳密なパースが必要な場合あり)
      if (
        !line.startsWith("WEBVTT") &&
        !line.startsWith("NOTE") &&
        line.trim()
      ) {
        transcriptText += line.trim() + " ";
      }
    }
  }
  console.log("Transcript downloaded and parsed.");
  return transcriptText.trim();
}
