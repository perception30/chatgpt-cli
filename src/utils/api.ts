import axios from "axios";
import fs from "node:fs";
import { loadSession, loadHeaders } from "./session.js";
import { ChatMessage, ChatResponse } from "../types/index.js";

type AxiosRequestConfig = {
  headers?: Record<string, string>;
};

const API_URL = "https://chatgpt.com/backend-api";

// Create axios instance with session cookies
const createApiClient = () => {
  // Try to load session from current directory first, then fall back to home directory
  let session = null;
  try {
    if (fs.existsSync("session.json")) {
      const data = fs.readFileSync("session.json", "utf8");
      session = JSON.parse(data);
      console.log("Using session from current directory");
    } else {
      session = loadSession();
    }
  } catch (error) {
    console.error("Error loading session from current directory:", error);
    session = loadSession();
  }

  // Try to load headers from current directory first, then fall back to home directory
  let headers = null;
  try {
    if (fs.existsSync("headers.json")) {
      const data = fs.readFileSync("headers.json", "utf8");
      headers = JSON.parse(data);
      console.log("Using headers from current directory");
    } else {
      headers = loadHeaders();
    }
  } catch (error) {
    console.error("Error loading headers from current directory:", error);
    headers = loadHeaders();
  }

  if (!session) {
    throw new Error("No session found. Please login first.");
  }

  // Only include essential cookies to avoid "Request Header Or Cookie Too Large" error
  // Prioritize Cloudflare cookies to handle challenges
  const essentialCookieNames = [
    "__Secure-next-auth.session-token",
    "__Secure-next-auth.session-token.0",
    "__Secure-next-auth.session-token.1",
    "_puid",
    "cf_clearance",
    "__cf_bm", // Cloudflare bot management cookie
    "oai-sc", // OpenAI session cookie
    "__Secure-next-auth.callback-url",
    "__Host-next-auth.csrf-token",
    "oai-did",
    "oai-gn",
    "oai-hm",
    "oai-hlib",
    "oai-nav-state",
    "oai-last-model",
    "_uasid",
    "_umsid",
  ];

  // Important domains for authentication
  const relevantDomains = [
    "chat.openai.com",
    "chatgpt.com",
    "openai.com",
    "auth0.openai.com",
    "auth.openai.com",
    "cloudflare",
  ];

  // First, prioritize the most important cookies
  const criticalCookies = session.cookies.filter((cookie: any) =>
    essentialCookieNames.includes(cookie.name)
  );

  // Then add cookies from relevant domains, but only if we don't already have too many cookies
  let essentialCookies = [...criticalCookies];

  // Only add domain-based cookies if we don't have too many critical cookies already
  if (criticalCookies.length < 20) {
    const domainCookies = session.cookies.filter(
      (cookie: any) =>
        !essentialCookieNames.includes(cookie.name) &&
        relevantDomains.some((domain: string) => cookie.domain.includes(domain))
    );

    // Add domain cookies, but limit the total number to avoid header size issues
    const remainingSlots = 30 - essentialCookies.length;
    if (remainingSlots > 0 && domainCookies.length > 0) {
      essentialCookies = [
        ...essentialCookies,
        ...domainCookies.slice(0, remainingSlots),
      ];
    }
  }

  // Convert filtered cookies array to cookie string
  const cookieString = essentialCookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  // Log important cookies for debugging
  // Check for any session token cookie (including those with suffixes)
  const sessionTokenCookie = essentialCookies.find((cookie) =>
    cookie.name.startsWith("__Secure-next-auth.session-token")
  );
  const puidCookie = essentialCookies.find((cookie) => cookie.name === "_puid");
  const cfClearanceCookie = essentialCookies.find(
    (cookie) =>
      cookie.name === "cf_clearance" &&
      (cookie.domain.includes("chatgpt.com") ||
        cookie.domain.includes("openai.com"))
  );
  const cfBmCookie = essentialCookies.find(
    (cookie) => cookie.name === "__cf_bm"
  );

  console.log("API Client - Using cookies:");
  console.log("- Session token:", sessionTokenCookie ? "Present" : "Missing");
  console.log("- PUID:", puidCookie ? "Present" : "Missing");
  console.log("- CF clearance:", cfClearanceCookie ? "Present" : "Missing");
  console.log("- CF bot management:", cfBmCookie ? "Present" : "Missing");
  console.log(
    `- Total cookies sent: ${essentialCookies.length} (filtered from ${session.cookies.length})`
  );

  // Browser-like headers to help avoid detection
  const config: AxiosRequestConfig = {
    headers: {
      "User-Agent":
        session.userAgent ||
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      Cookie: cookieString,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Ch-Ua":
        '"Not/A)Brand";v="8", "Chromium";v="135", "Google Chrome";v="135"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"macOS"',
      Referer: "https://chatgpt.com/",
      Origin: "https://chatgpt.com",
      ...headers,
    },
  };

  if (session.accessToken) {
    config.headers!["Authorization"] = `Bearer ${session.accessToken}`;
    console.log("- Access token: Present");
  } else {
    console.log("- Access token: Missing");
  }

  return axios.create(config);
};

// Send a message to ChatGPT
export const sendMessage = async (
  message: string,
  conversationId?: string,
  retryCount = 0
): Promise<ChatResponse> => {
  const MAX_RETRIES = 3; // Increased maximum number of retries

  try {
    const client = createApiClient();

    // Generate a unique message ID and parent message ID
    const messageId = `message_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 10)}`;
    const parentMessageId = `parent_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 10)}`;

    const payload = {
      action: "next",
      messages: [
        {
          id: messageId,
          role: "user",
          content: {
            content_type: "text",
            parts: [message],
          },
        },
      ],
      model: "gpt-4o", // Using the latest model for better results
      parent_message_id: parentMessageId,
      ...(conversationId && { conversation_id: conversationId }),
    };

    // Calculate exponential backoff delay for retries
    const backoffDelay =
      retryCount === 0 ? 0 : Math.min(2000 * Math.pow(2, retryCount), 10000);

    if (backoffDelay > 0) {
      console.log(`Waiting ${backoffDelay / 1000} seconds before retry...`);
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }

    console.log(
      `Sending message to ChatGPT API... ${
        retryCount > 0 ? `(Retry ${retryCount}/${MAX_RETRIES})` : ""
      }`
    );

    const response = await client.post(`${API_URL}/conversation`, payload);
    console.log("Received response from ChatGPT API");

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

    // More detailed error logging
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error("Response status:", error.response.status);
      console.error(
        "Response headers:",
        JSON.stringify(error.response.headers, null, 2)
      );
      if (error.response.data) {
        console.error(
          "Response data:",
          typeof error.response.data === "string"
            ? error.response.data.substring(0, 500) + "..." // Truncate long HTML responses
            : JSON.stringify(error.response.data, null, 2)
        );
      }

      // Check for Cloudflare challenge or other authentication issues
      const isCloudflareChallengePresent =
        typeof error.response.data === "string" &&
        (error.response.data.includes("cf-challenge") ||
          error.response.data.includes("cloudflare") ||
          error.response.data.includes("cf_chl_") ||
          error.response.data.includes("challenge-platform") ||
          error.response.data.includes("_cf_chl_opt"));

      // Retry logic for Cloudflare challenges and other temporary errors
      if (
        (error.response.status === 403 ||
          error.response.status === 429 ||
          error.response.status === 500) &&
        retryCount < MAX_RETRIES
      ) {
        if (isCloudflareChallengePresent) {
          console.log(
            "\nDetected Cloudflare challenge. Waiting and retrying..."
          );
        } else {
          console.log(
            `\nReceived ${error.response.status} error. Waiting and retrying...`
          );
        }

        // Exponential backoff with jitter
        const baseDelay = Math.min(3000 * Math.pow(2, retryCount), 15000);
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;

        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(sendMessage(message, conversationId, retryCount + 1));
          }, delay);
        });
      }

      // Specific guidance for common errors
      if (
        error.response.status === 400 &&
        typeof error.response.data === "string" &&
        error.response.data.includes("Request Header Or Cookie Too Large")
      ) {
        console.error(
          "\nERROR: The cookie data is too large to send to the ChatGPT API."
        );
        console.error(
          "This is a known issue that can happen when you have many cookies."
        );
        console.error(
          "Try clearing your browser cookies or using a fresh Chrome profile."
        );
      } else if (error.response.status === 403) {
        if (isCloudflareChallengePresent) {
          console.error(
            "\nERROR: Cloudflare challenge detected. Your request was blocked by Cloudflare protection."
          );
          console.error(
            "This usually happens when ChatGPT's systems detect automated access."
          );
        } else {
          console.error(
            "\nERROR: Authentication failed. Your session may have expired."
          );
        }
        console.error(
          "Please run 'chatgpt login' again to refresh your session."
        );
      } else if (error.response.status === 401) {
        console.error(
          "\nERROR: Authentication failed. Your session has expired."
        );
        console.error(
          "Please run 'chatgpt login' again to refresh your session."
        );
      } else if (error.response.status === 429) {
        console.error(
          "\nERROR: Rate limit exceeded. ChatGPT is receiving too many requests."
        );
        console.error("Please wait a few minutes before trying again.");
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error("No response received from server");
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error("Error setting up request:", error.message);
    }

    return {
      message: {
        role: "assistant",
        content:
          "Sorry, there was an error communicating with ChatGPT: " +
          error.message +
          (retryCount > 0 ? " (After " + retryCount + " retries)" : ""),
      },
      conversationId: "",
      error: error.message,
    };
  }
};
