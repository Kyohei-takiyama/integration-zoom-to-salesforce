/**
 * Zoom Webhook関連の型定義
 */

// Zoom Webhookイベントの基本構造
export interface ZoomWebhookEvent {
  event: string;
  payload: {
    account_id: string;
    object: Record<string, any>;
  };
  event_ts: number;
}

// ミーティング作成イベント
export interface ZoomMeetingCreatedEvent extends ZoomWebhookEvent {
  event: "meeting.created";
  payload: {
    account_id: string;
    object: {
      id: string;
      uuid: string;
      host_id: string;
      topic: string;
      type: number;
      start_time: string;
      duration: number;
      timezone: string;
      agenda: string;
      join_url: string;
      settings: {
        host_video: boolean;
        participant_video: boolean;
        cn_meeting: boolean;
        in_meeting: boolean;
        join_before_host: boolean;
        mute_upon_entry: boolean;
        watermark: boolean;
        use_pmi: boolean;
        approval_type: number;
        registration_type: number;
        audio: string;
        auto_recording: string;
        alternative_hosts: string;
        global_dial_in_countries: string[];
        registrants_email_notification: boolean;
      };
    };
  };
}

// ミーティング更新イベント
export interface ZoomMeetingUpdatedEvent extends ZoomWebhookEvent {
  event: "meeting.updated";
  payload: {
    account_id: string;
    object: {
      id: string;
      uuid: string;
      host_id: string;
      topic: string;
      type: number;
      start_time: string;
      duration: number;
      timezone: string;
      agenda: string;
      join_url: string;
      settings: {
        host_video: boolean;
        participant_video: boolean;
        cn_meeting: boolean;
        in_meeting: boolean;
        join_before_host: boolean;
        mute_upon_entry: boolean;
        watermark: boolean;
        use_pmi: boolean;
        approval_type: number;
        registration_type: number;
        audio: string;
        auto_recording: string;
        alternative_hosts: string;
        global_dial_in_countries: string[];
        registrants_email_notification: boolean;
      };
    };
  };
}

// ミーティング削除イベント
export interface ZoomMeetingDeletedEvent extends ZoomWebhookEvent {
  event: "meeting.deleted";
  payload: {
    account_id: string;
    object: {
      id: string;
      uuid: string;
      host_id: string;
    };
  };
}

// ミーティング開始イベント
export interface ZoomMeetingStartedEvent extends ZoomWebhookEvent {
  event: "meeting.started";
  payload: {
    account_id: string;
    object: {
      id: string;
      uuid: string;
      host_id: string;
      topic: string;
      type: number;
      start_time: string;
      duration: number;
      timezone: string;
    };
  };
}

// ミーティング終了イベント
export interface ZoomMeetingEndedEvent extends ZoomWebhookEvent {
  event: "meeting.ended";
  payload: {
    account_id: string;
    object: {
      id: string;
      uuid: string;
      host_id: string;
      topic: string;
      type: number;
      start_time: string;
      duration: number;
      timezone: string;
    };
  };
}

// 録画完了イベント
export interface ZoomRecordingCompletedEvent extends ZoomWebhookEvent {
  event: "recording.completed";
  payload: {
    account_id: string;
    object: {
      uuid: string;
      id: string;
      host_id: string;
      topic: string;
      type: number;
      start_time: string;
      duration: number;
      timezone: string;
      host_email: string;
      total_size: number;
      recording_count: number;
      share_url: string;
      recording_play_passcode?: string;
      recording_files: Array<{
        id: string;
        meeting_id: string;
        recording_start: string;
        recording_end: string;
        file_type: string;
        file_size: number;
        play_url: string;
        download_url: string;
        status: string;
        recording_type: string;
      }>;
    };
  };
}

// ミーティングサマリー完了イベント
export interface ZoomMeetingSummaryCompletedEvent extends ZoomWebhookEvent {
  event: "meeting.summary_completed";
  payload: {
    account_id: string;
    object: {
      uuid: string;
      id: string;
      host_id: string;
      topic: string;
      type: number;
      start_time: string;
      duration: number;
      timezone: string;
      host_email: string;
    };
  };
}

// サポートするZoom Webhookイベントの型
export type SupportedZoomWebhookEvent =
  | ZoomMeetingCreatedEvent
  | ZoomMeetingUpdatedEvent
  | ZoomMeetingDeletedEvent
  | ZoomMeetingStartedEvent
  | ZoomMeetingEndedEvent
  | ZoomRecordingCompletedEvent
  | ZoomMeetingSummaryCompletedEvent;

// Zoom API認証レスポンス
export interface ZoomAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// Zoom API Meeting情報
export interface ZoomMeeting {
  id: string;
  topic: string;
  type: number;
  start_time: string;
  duration: number;
  timezone: string;
  agenda: string;
  created_at: string;
  join_url: string;
  host_id: string;
  settings: {
    host_video: boolean;
    participant_video: boolean;
    join_before_host: boolean;
    mute_upon_entry: boolean;
    watermark: boolean;
    use_pmi: boolean;
    approval_type: number;
    audio: string;
    auto_recording: string;
  };
}

// Zoom API Meeting Summary情報
export interface ZoomMeetingSummary {
  uuid: string;
  id: number;
  host_id: string;
  topic: string;
  type: number;
  start_time: string;
  duration: number;
  timezone: string;
  created_at: string;
  join_url: string;
  agenda: string;
  summary: {
    total_minutes: number;
    issue_count: number;
    participant_count: number;
    chapters: Array<{
      title: string;
      start_time: string;
      end_time: string;
      summary: string;
    }>;
    timeline: Array<{
      title: string;
      start_time: string;
      end_time: string;
    }>;
    summary_text: string;
  };
}

// Zoom API ユーザーミーティング一覧レスポンス
export interface ZoomUserMeetingsResponse {
  page_count: number;
  page_number: number;
  page_size: number;
  total_records: number;
  meetings: ZoomMeeting[];
}
