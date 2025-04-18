import axios from "axios";
import { loadSession, loadHeaders } from "./session.js";
import { ChatMessage, ChatResponse } from "../types/index.js";

type AxiosRequestConfig = {
  headers?: Record<string, string>;
};

const API_URL = "https://chat.openai.com/backend-api";

// Create axios instance with session cookies
const createApiClient = () => {
  const session = loadSession();
  const headers = loadHeaders();

  if (!session) {
    throw new Error("No session found. Please login first.");
  }

  // Convert cookies array to cookie string
  const cookieString = session.cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const config: AxiosRequestConfig = {
    headers: {
      "User-Agent": session.userAgent,
      Cookie: cookieString,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...headers,
    },
  };

  if (session.accessToken) {
    config.headers!["Authorization"] = `Bearer ${session.accessToken}`;
  }

  return axios.create(config);
};

// Send a message to ChatGPT
export const sendMessage = async (
  message: string,
  conversationId?: string
): Promise<ChatResponse> => {
  try {
    const client = createApiClient();

    const payload = {
      action: "next",
      messages: [
        {
          id: `message_${Date.now()}`,
          role: "user",
          content: {
            content_type: "text",
            parts: [message],
          },
        },
      ],
      model: "text-davinci-002-render-sha",
      parent_message_id: `parent_${Date.now()}`,
      ...(conversationId && { conversation_id: conversationId }),
    };

    const response = await client.post(`${API_URL}/conversation`, payload);

    // Parse the response (which is a text/event-stream)
    const data = response.data;
    const lines = data.split("\n").filter(Boolean);

    // Find the last data line (which contains the complete response)
    const lastDataLine = lines
      .filter(
        (line: string) => line.startsWith("data: ") && !line.includes("[DONE]")
      )
      .pop();

    if (!lastDataLine) {
      throw new Error("Invalid response from ChatGPT API");
    }

    const jsonData = JSON.parse(lastDataLine.substring(6));

    return {
      message: {
        role: "assistant",
        content: jsonData.message.content.parts.join("\n"),
      },
      conversationId: jsonData.conversation_id,
    };
  } catch (error: any) {
    console.error("Error sending message:", error.message);
    return {
      message: {
        role: "assistant",
        content: "Sorry, there was an error communicating with ChatGPT.",
      },
      conversationId: "",
      error: error.message,
    };
  }
};
