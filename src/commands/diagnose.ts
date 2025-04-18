import chalk from "chalk";
import ora from "ora";
import { AuthHelper } from "../utils/auth-helper.js";
import { loadSession, loadHeaders } from "../utils/session.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * Diagnose authentication issues and provide solutions
 */
export async function diagnose(): Promise<void> {
  console.log(chalk.blue("ChatGPT CLI - Authentication Diagnostics"));
  console.log(chalk.dim("---------------------------------------------------"));
  
  const spinner = ora("Checking session data...").start();
  
  // Check if session files exist
  const homeSessionPath = path.join(os.homedir(), ".chatgpt-cli", "session.json");
  const localSessionPath = "session.json";
  
  const hasHomeSession = fs.existsSync(homeSessionPath);
  const hasLocalSession = fs.existsSync(localSessionPath);
  
  spinner.succeed("Session check complete");
  
  console.log(chalk.dim("\nSession files:"));
  console.log(`Home directory session: ${hasHomeSession ? chalk.green("Found") : chalk.red("Not found")} (${homeSessionPath})`);
  console.log(`Current directory session: ${hasLocalSession ? chalk.green("Found") : chalk.red("Not found")} (${localSessionPath})`);
  
  // Load session data
  let session = null;
  
  if (hasLocalSession) {
    try {
      const data = fs.readFileSync(localSessionPath, "utf8");
      session = JSON.parse(data);
      console.log(chalk.green("\nUsing session from current directory"));
    } catch (error) {
      console.log(chalk.red(`\nError reading local session: ${error}`));
    }
  } else if (hasHomeSession) {
    try {
      const data = fs.readFileSync(homeSessionPath, "utf8");
      session = JSON.parse(data);
      console.log(chalk.green("\nUsing session from home directory"));
    } catch (error) {
      console.log(chalk.red(`\nError reading home session: ${error}`));
    }
  }
  
  if (!session) {
    console.log(chalk.red("\nNo valid session found. Please run 'chatgpt login' to create a new session."));
    return;
  }
  
  // Analyze session data
  console.log(chalk.dim("\nSession analysis:"));
  
  // Check cookies
  if (!session.cookies || !Array.isArray(session.cookies) || session.cookies.length === 0) {
    console.log(chalk.red("No cookies found in session data."));
    return;
  }
  
  console.log(`Total cookies: ${session.cookies.length}`);
  
  // Check for essential cookies
  const sessionTokenCookie = session.cookies.find((cookie: any) => 
    cookie.name.startsWith("__Secure-next-auth.session-token")
  );
  
  const puidCookie = session.cookies.find((cookie: any) => 
    cookie.name === "_puid"
  );
  
  const cfClearanceCookie = session.cookies.find((cookie: any) => 
    cookie.name === "cf_clearance"
  );
  
  console.log(`Session token cookie: ${sessionTokenCookie ? chalk.green("Present") : chalk.red("Missing")}`);
  console.log(`PUID cookie: ${puidCookie ? chalk.green("Present") : chalk.red("Missing")}`);
  console.log(`CF clearance cookie: ${cfClearanceCookie ? chalk.green("Present") : chalk.red("Missing")}`);
  
  // Check for cookie expiration
  const now = Date.now() / 1000; // Current time in seconds
  
  if (sessionTokenCookie && sessionTokenCookie.expires) {
    const isExpired = sessionTokenCookie.expires < now;
    console.log(`Session token expiration: ${isExpired ? chalk.red("Expired") : chalk.green("Valid")} (${new Date(sessionTokenCookie.expires * 1000).toLocaleString()})`);
  }
  
  if (cfClearanceCookie && cfClearanceCookie.expires) {
    const isExpired = cfClearanceCookie.expires < now;
    console.log(`CF clearance expiration: ${isExpired ? chalk.red("Expired") : chalk.green("Valid")} (${new Date(cfClearanceCookie.expires * 1000).toLocaleString()})`);
  }
  
  // Check user agent
  console.log(`User agent: ${session.userAgent ? chalk.green("Present") : chalk.red("Missing")}`);
  
  // Check access token
  console.log(`Access token: ${session.accessToken ? chalk.green("Present") : chalk.yellow("Missing (not critical)")}`);
  
  // Provide recommendations
  console.log(chalk.blue("\nRecommendations:"));
  
  const hasSessionToken = !!sessionTokenCookie;
  const hasPuid = !!puidCookie;
  const hasCfClearance = !!cfClearanceCookie;
  
  const isSessionTokenExpired = sessionTokenCookie && sessionTokenCookie.expires && sessionTokenCookie.expires < now;
  const isCfClearanceExpired = cfClearanceCookie && cfClearanceCookie.expires && cfClearanceCookie.expires < now;
  
  if (!hasSessionToken || isSessionTokenExpired) {
    console.log(chalk.yellow("- Session token is missing or expired. Run 'chatgpt login' to refresh your session."));
  }
  
  if (!hasCfClearance || isCfClearanceExpired) {
    console.log(chalk.yellow("- Cloudflare clearance cookie is missing or expired. Run 'chatgpt login' to refresh your session."));
  }
  
  if (!hasPuid) {
    console.log(chalk.yellow("- PUID cookie is missing. Run 'chatgpt login' to refresh your session."));
  }
  
  if (hasSessionToken && hasPuid && hasCfClearance && !isSessionTokenExpired && !isCfClearanceExpired) {
    console.log(chalk.green("- Your session appears to be valid. If you're still experiencing issues:"));
    console.log(chalk.green("  1. Try running 'chatgpt login' to refresh your session"));
    console.log(chalk.green("  2. Make sure you're not using a VPN or proxy that might be blocked by Cloudflare"));
    console.log(chalk.green("  3. Try clearing your browser cookies and logging in again"));
  }
  
  console.log(chalk.dim("\nFor persistent issues, you may need to:"));
  console.log(chalk.dim("1. Use a different browser for login"));
  console.log(chalk.dim("2. Clear all cookies for chatgpt.com and openai.com domains"));
  console.log(chalk.dim("3. Disable browser extensions that might interfere with the login process"));
}
