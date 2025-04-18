import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { SessionData } from "../types/index.js";

const CONFIG_DIR = path.join(os.homedir(), ".chatgpt-cli");
const SESSION_FILE = path.join(CONFIG_DIR, "session.json");
const HEADERS_FILE = path.join(CONFIG_DIR, "headers.json");

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

  // Check if any of the cookies are expired
  const now = Date.now();
  const hasExpiredCookies = session.cookies.some(
    (cookie) => cookie.expires && cookie.expires < now / 1000
  );

  console.log("Cookies expired:", hasExpiredCookies);
  return !hasExpiredCookies;
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
