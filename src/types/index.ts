export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
}

export interface SessionData {
  cookies: Cookie[];
  userAgent: string;
  accessToken?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResponse {
  message: ChatMessage;
  conversationId: string;
  error?: string;
}
