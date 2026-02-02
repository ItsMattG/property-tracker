export interface GmailTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface GmailMessageHeader {
  name: string;
  value: string;
}

export interface GmailMessagePart {
  mimeType: string;
  body?: {
    data?: string;
    size?: number;
  };
  parts?: GmailMessagePart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload: {
    headers: GmailMessageHeader[];
    mimeType?: string;
    body?: {
      data?: string;
      size?: number;
    };
    parts?: GmailMessagePart[];
  };
  internalDate: string;
  sizeEstimate?: number;
}

export interface GmailMessageList {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface ParsedEmail {
  id: string;
  threadId: string;
  from: string;
  fromName?: string;
  subject: string;
  date: Date;
  bodyText?: string;
  bodyHtml?: string;
}
