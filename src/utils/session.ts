import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { SessionData } from "../types/index.js";

const CONFIG_DIR = path.join(os.homedir(), ".chatgpt-cli");
const SESSION_FILE = path.join(CONFIG_DIR, "session.json");
const HEADERS_FILE = path.join(CONFIG_DIR, "headers.json");

// Current directory files
const CURRENT_DIR_SESSION_FILE = "session.json";
const CURRENT_DIR_HEADERS_FILE = "headers.json";

// Ensure config directory exists
export const ensureConfigDir = (): void => {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
};

// Save session data
export const saveSession = (sessionData: SessionData): void => {
  ensureConfigDir();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2));
};

// Load session data
export const loadSession = (): SessionData | null => {
  try {
    console.log("Checking for session file at:", SESSION_FILE);
    if (fs.existsSync(SESSION_FILE)) {
      console.log("Session file exists, loading...");
      const data = fs.readFileSync(SESSION_FILE, "utf8");
      const session = JSON.parse(data) as SessionData;
      console.log("Session loaded successfully");
      return session;
    }
    console.log("Session file does not exist");
    return null;
  } catch (error) {
    console.error("Error loading session:", error);
    return null;
  }
};

// Check if session exists and is valid
export const checkSession = async (): Promise<boolean> => {
  const session = loadSession();
  console.log("Session check:", session ? "Session found" : "No session found");
  if (!session) return false;

  // Check if essential cookies exist and are not expired
  const now = Date.now() / 1000; // Current time in seconds

  // Check for session token cookie (including those with suffixes)
  const sessionTokenCookie = session.cookies.find((cookie) =>
    cookie.name.startsWith("__Secure-next-auth.session-token")
  );

  // Check for PUID and CF clearance cookies
  const puidCookie = session.cookies.find((cookie) => cookie.name === "_puid");
  const cfClearanceCookie = session.cookies.find(
    (cookie) => cookie.name === "cf_clearance"
  );

  // Log cookie status
  console.log(
    "Session token cookie:",
    sessionTokenCookie ? "Found" : "Not found"
  );
  console.log("PUID cookie:", puidCookie ? "Found" : "Not found");
  console.log(
    "CF clearance cookie:",
    cfClearanceCookie ? "Found" : "Not found"
  );

  // Check if session token cookie exists and is not expired
  const hasValidSessionToken =
    sessionTokenCookie &&
    (!sessionTokenCookie.expires || sessionTokenCookie.expires > now);

  // Check if PUID and CF clearance cookies exist and are not expired
  const hasValidPuid =
    puidCookie && (!puidCookie.expires || puidCookie.expires > now);
  const hasValidCfClearance =
    cfClearanceCookie &&
    (!cfClearanceCookie.expires || cfClearanceCookie.expires > now);

  // We need either session token OR both PUID and CF clearance
  // This allows the tool to work even when session token is missing
  const isValid = hasValidSessionToken || (hasValidPuid && hasValidCfClearance);

  console.log("Session valid:", isValid ? true : false);

  // Log additional debug info
  if (!isValid) {
    console.log("Session validation failed. Details:");
    if (!hasValidSessionToken) {
      console.log("- Session token cookie is missing or expired");
    }
    if (!hasValidPuid) {
      console.log("- PUID cookie is missing or expired");
    }
    if (!hasValidCfClearance) {
      console.log("- CF clearance cookie is missing or expired");
    }
  }

  return isValid === true;
};

// Save headers from browser for API requests
export const saveHeaders = (headers: Record<string, string>): void => {
  ensureConfigDir();
  fs.writeFileSync(HEADERS_FILE, JSON.stringify(headers, null, 2));
};

// Load headers for API requests
export const loadHeaders = (): Record<string, string> | null => {
  try {
    if (fs.existsSync(HEADERS_FILE)) {
      const data = fs.readFileSync(HEADERS_FILE, "utf8");
      return JSON.parse(data) as Record<string, string>;
    }
    return null;
  } catch (error) {
    console.error("Error loading headers:", error);
    return null;
  }
};

// Save session data to current directory
export const saveSessionToCurrentDir = (sessionData: SessionData): void => {
  fs.writeFileSync(
    CURRENT_DIR_SESSION_FILE,
    JSON.stringify(sessionData, null, 2)
  );
  console.log(
    `Session data saved to ${CURRENT_DIR_SESSION_FILE} in current directory`
  );
};

// Save headers to current directory
export const saveHeadersToCurrentDir = (
  headers: Record<string, string>
): void => {
  fs.writeFileSync(CURRENT_DIR_HEADERS_FILE, JSON.stringify(headers, null, 2));
  console.log(
    `Headers saved to ${CURRENT_DIR_HEADERS_FILE} in current directory`
  );
};

// Save both session and headers to current directory
export const saveToCurrentDir = (): boolean => {
  try {
    const session = loadSession();
    const headers = loadHeaders();

    if (!session) {
      console.error("No session found to save to current directory");
      return false;
    }

    saveSessionToCurrentDir(session);

    if (headers) {
      saveHeadersToCurrentDir(headers);
    } else {
      console.warn("No headers found to save to current directory");
    }

    return true;
  } catch (error) {
    console.error("Error saving to current directory:", error);
    return false;
  }
};
