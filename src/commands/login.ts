import chalk from "chalk";
import ora from "ora";
import * as chromeLauncher from "chrome-launcher";
// @ts-ignore - No type definitions available
import CDP from "chrome-remote-interface";
import {
  saveSession,
  saveHeaders,
  saveSessionToCurrentDir,
  saveHeadersToCurrentDir,
} from "../utils/session.js";
import { SessionData, Cookie } from "../types/index.js";
import { execSync } from "child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const CHATGPT_URL = "https://chat.openai.com/auth/login";
const CHAT_URL = "https://chat.openai.com/";

// Function to find Chrome debugging ports from running Chrome instances
async function findChromeDebuggingPorts(): Promise<number[]> {
  try {
    // Different commands for different platforms
    let cmd = "";
    if (process.platform === "darwin") {
      // macOS
      cmd =
        'ps -ax | grep "Google Chrome" | grep "remote-debugging-port" | grep -v grep';
    } else if (process.platform === "linux") {
      cmd =
        'ps -ax | grep "chrome" | grep "remote-debugging-port" | grep -v grep';
    } else if (process.platform === "win32") {
      cmd =
        'wmic process where "name=\'chrome.exe\'" get commandline | findstr "remote-debugging-port"';
    } else {
      return []; // Unsupported platform
    }

    // Execute the command
    const output = execSync(cmd, { encoding: "utf8" });

    // Parse the output to find debugging ports
    const ports: number[] = [];
    const regex = /--remote-debugging-port=(\d+)/;

    output.split("\n").forEach((line) => {
      const match = line.match(regex);
      if (match && match[1]) {
        const port = parseInt(match[1], 10);
        if (!isNaN(port)) {
          ports.push(port);
        }
      }
    });

    return ports;
  } catch (error) {
    // If the command fails or no Chrome instances are found
    return [];
  }
}

export async function login(): Promise<void> {
  let spinner = ora("Preparing to connect to Chrome...").start();

  try {
    // Try to find existing Chrome instances
    spinner.text = "Looking for existing Chrome instances...";
    const existingPorts = await findChromeDebuggingPorts();

    let chrome;
    let usingExistingChrome = false;

    if (existingPorts.length > 0) {
      // Use the first available Chrome instance
      const port = existingPorts[0];
      console.log(
        chalk.green(`Found existing Chrome instance on port ${port}`)
      );

      // Create a dummy chrome object that won't kill the browser when we're done
      chrome = {
        port,
        kill: () => Promise.resolve(), // Dummy kill function that does nothing
      };
      usingExistingChrome = true;
    } else {
      // No existing Chrome with debugging port, launch a new one
      spinner.text =
        "No existing Chrome with debugging port found. Launching new Chrome instance...";

      // Launch Chrome with the user's default profile and a debugging port
      chrome = await chromeLauncher.launch({
        startingUrl: "about:blank", // Start with a blank page, we'll navigate later
        chromeFlags: ["--disable-extensions"],
        userDataDir: undefined, // Use default user profile
      });

      console.log(
        chalk.dim(`Chrome launched on debugging port ${chrome.port}`)
      );
    }

    spinner.stop();
    console.log(
      chalk.yellow("\nChrome has been opened for you to log in to ChatGPT.")
    );
    console.log(
      chalk.yellow("Please complete any verification challenges and log in.")
    );
    console.log(
      chalk.yellow("The CLI will continue automatically once you're logged in.")
    );
    console.log(
      chalk.yellow(
        "This window will wait for up to 5 minutes for you to complete the login."
      )
    );

    // Connect to Chrome DevTools Protocol
    let client;
    try {
      client = await CDP({ port: chrome.port });
    } catch (error: any) {
      throw new Error(`Failed to connect to Chrome: ${error.message}`);
    }

    // Extract domains we need
    const { Network, Page, Runtime, Target } = client;

    // Open a new tab with the ChatGPT login page
    try {
      // Create a new tab
      const { targetId } = await Target.createTarget({
        url: "about:blank",
        newWindow: false,
      });

      console.log(chalk.dim(`Created new tab with target ID: ${targetId}`));

      // Attach to the new tab
      const newTarget = await CDP({ port: chrome.port, target: targetId });

      // Extract domains from the new tab
      const {
        Network: newNetwork,
        Page: newPage,
        Runtime: newRuntime,
      } = newTarget;

      // Enable necessary domains in the new tab
      await Promise.all([newNetwork.enable(), newPage.enable()]);

      // Navigate to ChatGPT login page in the new tab
      await newPage.navigate({ url: "https://chat.openai.com/auth/login" });

      // Use the new tab's domains for the rest of the script
      Network.disable(); // Disable the original tab's domains
      Page.disable();

      // Replace with the new tab's domains
      Object.assign(client, newTarget);
      Object.assign(
        { Network, Page, Runtime },
        { Network: newNetwork, Page: newPage, Runtime: newRuntime }
      );
    } catch (error: any) {
      console.log(
        chalk.yellow(
          `Error creating new tab: ${error.message || "Unknown error"}`
        )
      );
      console.log(chalk.yellow("Continuing with the current tab..."));

      // Navigate to ChatGPT login page in the current tab
      await Page.navigate({ url: "https://chat.openai.com/auth/login" });
      await Page.loadEventFired();
    }

    // Enable necessary domains
    await Promise.all([Network.enable(), Page.enable()]);

    // Setup Network to capture request headers
    const headers: Record<string, string> = {};
    Network.requestWillBeSent((params: any) => {
      if (params.request.url.includes("chat.openai.com/backend-api")) {
        const requestHeaders = params.request.headers;
        Object.keys(requestHeaders).forEach((key) => {
          if (
            key.toLowerCase() !== "cookie" &&
            key.toLowerCase() !== "user-agent"
          ) {
            headers[key] = requestHeaders[key];
          }
        });
      }
    });

    // Wait for the user to successfully log in and reach the chat page
    let isLoggedIn = false;
    const maxWaitTime = 5 * 60 * 1000; // 5 minutes
    const startTime = Date.now();

    console.log(chalk.yellow("\nWaiting for successful login..."));

    while (!isLoggedIn && Date.now() - startTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Check every 2 seconds

      try {
        // Method 1: Check URL
        const currentUrlResult = await Runtime.evaluate({
          expression: "window.location.href",
        });

        const currentUrl = currentUrlResult.result.value;

        // Check if we're on a ChatGPT domain
        const isChatGPTDomain =
          currentUrl.includes("chat.openai.com") ||
          currentUrl.includes("chatgpt.com");

        // Check for specific URLs that indicate we're NOT logged in
        const isLoginPage =
          currentUrl.includes("/auth/login") ||
          currentUrl.includes("/auth/callback") ||
          currentUrl.includes("/auth/signup");

        // Method 2: Check for chat interface elements
        const hasChatElements = await Runtime.evaluate({
          expression: `
            (document.querySelector('main h1.text-4xl') !== null) || // New chat page
            (document.querySelector('.flex-col.flex-1') !== null) || // Chat interface
            (document.querySelector('[data-testid="send-button"]') !== null) // Send button
          `,
        });

        // Method 3: Check if we're logged in by looking for user menu
        const hasUserMenu = await Runtime.evaluate({
          expression: `document.querySelector('[data-testid="user-menu-button"]') !== null`,
        });

        // Method 4: Check for essential cookies using Network API instead of document.cookie
        // This can access HttpOnly cookies that aren't visible to JavaScript
        let cookieStatus = {
          hasSessionToken: false,
          hasPuid: false,
          hasCfClearance: false,
        };

        try {
          // Get all cookies using CDP Network domain
          const allCookiesResult = await Network.getAllCookies();
          if (allCookiesResult && allCookiesResult.cookies) {
            const allCookies = allCookiesResult.cookies;

            // Check for essential cookies
            cookieStatus = {
              hasSessionToken: allCookies.some((c: any) =>
                c.name.startsWith("__Secure-next-auth.session-token")
              ),
              hasPuid: allCookies.some((c: any) => c.name === "_puid"),
              hasCfClearance: allCookies.some(
                (c: any) => c.name === "cf_clearance"
              ),
            };
          }
        } catch (error: any) {
          console.log(
            chalk.dim(
              `Error checking cookies: ${error.message || "Unknown error"}`
            )
          );
        }

        // Debug info
        console.log(chalk.dim(`Current URL: ${currentUrl}`));
        console.log(chalk.dim(`Is ChatGPT domain: ${isChatGPTDomain}`));
        console.log(chalk.dim(`Is login page: ${isLoginPage}`));
        console.log(
          chalk.dim(`Chat elements detected: ${hasChatElements.result.value}`)
        );
        console.log(
          chalk.dim(`User menu detected: ${hasUserMenu.result.value}`)
        );
        console.log(
          chalk.dim(`Session token cookie: ${cookieStatus.hasSessionToken}`)
        );
        console.log(chalk.dim(`PUID cookie: ${cookieStatus.hasPuid}`));
        console.log(
          chalk.dim(`CF clearance cookie: ${cookieStatus.hasCfClearance}`)
        );

        // Check if we're truly logged in - must have user menu or chat elements AND at least some essential cookies
        // We'll be more flexible about which cookies are required
        const hasSessionToken = cookieStatus.hasSessionToken;
        const hasPuidOrClearance =
          cookieStatus.hasPuid || cookieStatus.hasCfClearance;
        const hasEssentialCookies = hasSessionToken && hasPuidOrClearance;

        // Also check if we're on a chat conversation page, which is a strong indicator of being logged in
        const isOnChatPage =
          currentUrl.includes("/c/") || currentUrl.includes("/chat/");

        const hasLoginUI =
          hasUserMenu.result.value === true ||
          hasChatElements.result.value === true;

        // We're logged in if we're on a ChatGPT domain and meet certain conditions
        if (
          // On a chat conversation page with some cookies (very strong indicator of being logged in)
          (isOnChatPage &&
            (hasSessionToken || hasPuidOrClearance) &&
            isChatGPTDomain) ||
          // On the main chat page with essential cookies
          (isChatGPTDomain && !isLoginPage && hasEssentialCookies) ||
          // Has UI elements and some cookies and not on login page
          (hasLoginUI && hasSessionToken && !isLoginPage && isChatGPTDomain) ||
          // Special case: On a chat page with chat elements (very strong indicator of being logged in)
          (isOnChatPage && hasLoginUI && isChatGPTDomain)
        ) {
          console.log(
            chalk.green("Login detected! You've successfully logged in.")
          );
          isLoggedIn = true;
        }
      } catch (error: any) {
        console.log(
          chalk.dim(
            `Error checking login status: ${error.message || "Unknown error"}`
          )
        );
      }
    }

    if (!isLoggedIn) {
      if (!usingExistingChrome) {
        chrome.kill();
      }
      throw new Error("Login timed out after 5 minutes. Please try again.");
    }

    console.log(
      chalk.green("\nSuccessfully logged in! Capturing session data...")
    );

    spinner = ora("Capturing session data...").start();

    // Make sure we're on the chat page to capture all necessary data
    try {
      // Check if we need to navigate to the chat page
      const currentUrlResult = await Runtime.evaluate({
        expression: "window.location.href",
      });

      const currentUrl = currentUrlResult.result.value;
      if (!currentUrl.includes("chat.openai.com")) {
        // Navigate to the chat page if we're not on it
        await Page.navigate({ url: CHAT_URL });
        await Page.loadEventFired();

        // Wait a bit to ensure cookies are set properly
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      console.log(
        chalk.dim(
          `Error navigating to chat page: ${error.message || "Unknown error"}`
        )
      );
      // Continue anyway, we'll try to get the cookies
    }

    // Get cookies - with enhanced retry mechanism
    let cookiesResult;
    let retryCount = 0;
    const maxRetries = 5; // Increased from 3 to 5

    // Try different methods to get cookies
    const getCookiesWithMethod = async (method: string) => {
      console.log(chalk.dim(`Trying to get cookies using ${method}...`));
      try {
        if (method === "getAllCookies") {
          return await Network.getAllCookies();
        } else if (method === "getCookies") {
          // Try with specific domain
          return await Network.getCookies({
            urls: ["https://chat.openai.com/", "https://chatgpt.com/"],
          });
        } else if (method === "document.cookie") {
          // Try with JavaScript
          const docCookieResult = await Runtime.evaluate({
            expression: `
              (function() {
                return document.cookie;
              })()
            `,
          });

          if (docCookieResult.result.value) {
            // Parse document.cookie string into cookie objects
            const cookieStr = docCookieResult.result.value;
            console.log(
              chalk.dim(`Got document.cookie: ${cookieStr.substring(0, 50)}...`)
            );
            // This won't have HttpOnly cookies, but we'll combine with other methods
            return { cookies: [] };
          }
        }
        return null;
      } catch (error: any) {
        console.log(
          chalk.dim(
            `Error getting cookies with ${method}: ${
              error.message || "Unknown error"
            }`
          )
        );
        return null;
      }
    };

    while (retryCount < maxRetries) {
      try {
        // Try different methods in sequence
        cookiesResult = await getCookiesWithMethod("getAllCookies");

        if (
          !cookiesResult ||
          !cookiesResult.cookies ||
          cookiesResult.cookies.length === 0
        ) {
          cookiesResult = await getCookiesWithMethod("getCookies");
        }

        if (
          !cookiesResult ||
          !cookiesResult.cookies ||
          cookiesResult.cookies.length === 0
        ) {
          await getCookiesWithMethod("document.cookie");
          cookiesResult = await getCookiesWithMethod("getAllCookies"); // Try again after document.cookie
        }

        if (
          cookiesResult &&
          cookiesResult.cookies &&
          cookiesResult.cookies.length > 0
        ) {
          // Check if we have the session token cookie (including those with suffixes)
          const hasSessionToken = cookiesResult.cookies.some((c: any) =>
            c.name.startsWith("__Secure-next-auth.session-token")
          );

          if (hasSessionToken) {
            console.log(chalk.dim("Found session token cookie!"));
            break; // Successfully got cookies including session token
          } else {
            console.log(
              chalk.dim("Got cookies but session token is missing. Retrying...")
            );
          }
        }
      } catch (error: any) {
        console.log(
          chalk.dim(
            `Error getting cookies (attempt ${retryCount + 1}): ${
              error.message || "Unknown error"
            }`
          )
        );
      }

      retryCount++;
      if (retryCount < maxRetries) {
        console.log(
          chalk.dim(`Retrying to get cookies (attempt ${retryCount + 1})...`)
        );
        // Navigate to the chat page again to refresh cookies
        try {
          await Page.navigate({ url: CHAT_URL });
          await Page.loadEventFired();
          // Wait longer between retries
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error: any) {
          console.log(
            chalk.dim(`Error navigating: ${error.message || "Unknown error"}`)
          );
        }
      }
    }

    if (
      !cookiesResult ||
      !cookiesResult.cookies ||
      cookiesResult.cookies.length === 0
    ) {
      throw new Error("Failed to capture cookies. Please try again.");
    }

    console.log(
      chalk.dim(`Successfully captured ${cookiesResult.cookies.length} cookies`)
    );

    const cookies: Cookie[] = cookiesResult.cookies.map((cookie: any) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite as string,
    }));

    // Get user agent
    const userAgentResult = await Runtime.evaluate({
      expression: "navigator.userAgent",
    });
    const userAgent = userAgentResult.result.value;

    // Try to get access token from localStorage with multiple methods
    let accessToken: string | undefined;

    // Method 1: Try to get from oai-auth
    try {
      const accessTokenResult = await Runtime.evaluate({
        expression:
          "JSON.parse(localStorage.getItem('oai-auth') || '{}').accessToken",
      });

      if (accessTokenResult.result.value) {
        accessToken = accessTokenResult.result.value;
        console.log(chalk.dim("Access token retrieved from oai-auth"));
      }
    } catch (error: any) {
      console.log(
        chalk.dim(
          `Error getting access token from oai-auth: ${
            error.message || "Unknown error"
          }`
        )
      );
    }

    // Method 2: Try to get from __NEXT_DATA__ if Method 1 failed
    if (!accessToken) {
      try {
        const nextDataResult = await Runtime.evaluate({
          expression: `
            (function() {
              const nextDataEl = document.getElementById('__NEXT_DATA__');
              if (nextDataEl) {
                const data = JSON.parse(nextDataEl.textContent || '{}');
                return data.props?.pageProps?.accessToken || null;
              }
              return null;
            })()
          `,
        });

        if (nextDataResult.result.value) {
          accessToken = nextDataResult.result.value;
          console.log(chalk.dim("Access token retrieved from __NEXT_DATA__"));
        }
      } catch (error: any) {
        console.log(
          chalk.dim(
            `Error getting access token from __NEXT_DATA__: ${
              error.message || "Unknown error"
            }`
          )
        );
      }
    }

    if (accessToken) {
      console.log(chalk.dim("Successfully retrieved access token"));
    } else {
      console.log(
        chalk.yellow(
          "Could not retrieve access token. Some features might not work properly."
        )
      );
    }

    // Check if we have the essential cookies
    const essentialCookies = [
      "__Secure-next-auth.session-token",
      "__Secure-next-auth.session-token.0",
      "__Secure-next-auth.session-token.1",
      "_puid",
      "cf_clearance",
    ];
    const missingCookies = essentialCookies.filter(
      (name) => !cookies.some((cookie) => cookie.name === name)
    );

    // Check for authentication cookies
    // We need at least one of these authentication cookies
    const hasSessionToken = cookies.some((cookie) =>
      cookie.name.startsWith("__Secure-next-auth.session-token")
    );
    const hasPuid = cookies.some((cookie) => cookie.name === "_puid");
    const hasCfClearance = cookies.some(
      (cookie) => cookie.name === "cf_clearance"
    );

    // For your account, we'll consider having PUID and CF clearance as sufficient even without session token
    const hasAuthCookies = hasSessionToken || (hasPuid && hasCfClearance);

    // Create a list of missing cookies for error reporting
    const missingCriticalCookies = [];
    if (!hasAuthCookies) {
      if (!hasSessionToken) {
        missingCriticalCookies.push("__Secure-next-auth.session-token");
      }
      if (!hasPuid) {
        missingCriticalCookies.push("_puid");
      }
      if (!hasCfClearance) {
        missingCriticalCookies.push("cf_clearance");
      }
    }

    if (missingCriticalCookies.length > 0) {
      // If critical cookies are missing, we can't proceed
      spinner.fail("Failed to capture essential cookies");
      console.log(
        chalk.red(
          `Error: Missing critical cookies: ${missingCriticalCookies.join(
            ", "
          )}`
        )
      );
      console.log(
        chalk.red(
          "These cookies are required for authentication. Please try again and make sure you complete the login process."
        )
      );
      if (!usingExistingChrome) {
        chrome.kill();
      }
      throw new Error("Login failed: Missing critical cookies");
    } else if (missingCookies.length > 0) {
      // Non-critical cookies missing - warn but continue
      console.log(
        chalk.yellow(
          `Warning: Missing some cookies: ${missingCookies.join(", ")}`
        )
      );
      console.log(
        chalk.yellow("The CLI might not work properly without these cookies.")
      );
    } else {
      console.log(chalk.green("All essential cookies captured successfully!"));
    }

    // Filter cookies to only include essential ones and those from relevant domains
    // This helps prevent the "Request Header Or Cookie Too Large" error
    const relevantDomains = [
      "chat.openai.com",
      "chatgpt.com",
      "openai.com",
      "auth0.openai.com",
      "auth.openai.com",
      "cloudflare",
    ];

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

    // First, prioritize the most important cookies
    const criticalCookies = cookies.filter((cookie) =>
      essentialCookieNames.includes(cookie.name)
    );

    // Then add cookies from relevant domains, but only if we don't already have too many cookies
    let filteredCookies = [...criticalCookies];

    // Only add domain-based cookies if we don't have too many critical cookies already
    if (criticalCookies.length < 20) {
      const domainCookies = cookies.filter(
        (cookie) =>
          !essentialCookieNames.includes(cookie.name) &&
          relevantDomains.some((domain) => cookie.domain.includes(domain))
      );

      // Add domain cookies, but limit the total number to avoid header size issues
      const remainingSlots = 30 - filteredCookies.length;
      if (remainingSlots > 0 && domainCookies.length > 0) {
        filteredCookies = [
          ...filteredCookies,
          ...domainCookies.slice(0, remainingSlots),
        ];
      }
    }

    console.log(
      chalk.dim(
        `Filtered cookies: ${filteredCookies.length} (from original ${cookies.length})`
      )
    );

    // Check for Cloudflare cookies
    const cfClearanceCookie = filteredCookies.find(
      (c) => c.name === "cf_clearance"
    );
    const cfBmCookie = filteredCookies.find((c) => c.name === "__cf_bm");

    if (!cfClearanceCookie) {
      console.log(
        chalk.yellow(
          "Warning: Missing Cloudflare clearance cookie. This may cause issues with API access."
        )
      );
    } else {
      console.log(chalk.green("Found Cloudflare clearance cookie."));
    }

    if (!cfBmCookie) {
      console.log(
        chalk.dim(
          "No Cloudflare bot management cookie found. This is optional."
        )
      );
    } else {
      console.log(chalk.dim("Found Cloudflare bot management cookie."));
    }

    // Save session data
    const sessionData: SessionData = {
      cookies: filteredCookies,
      userAgent,
      accessToken,
    };

    saveSession(sessionData);
    saveHeaders(headers);

    // Also save to current directory
    saveSessionToCurrentDir(sessionData);
    saveHeadersToCurrentDir(headers);

    // Log the cookies we captured (names only for security)
    console.log(
      chalk.dim(
        "Captured cookies: " + filteredCookies.map((c) => c.name).join(", ")
      )
    );

    spinner.succeed("Successfully logged in and saved session");
    console.log(chalk.green("\nYou can now use 'chatgpt' to start chatting!"));

    // Close Chrome if we launched a new instance
    if (!usingExistingChrome) {
      console.log(chalk.dim("Closing Chrome instance..."));
      chrome.kill();
    } else {
      console.log(chalk.dim("Leaving existing Chrome instance running..."));
    }
  } catch (error: any) {
    if (spinner.isSpinning) {
      spinner.fail(`Login failed: ${error.message}`);
    } else {
      console.error(chalk.red(`\nLogin failed: ${error.message}`));
    }

    console.log(chalk.yellow("\nTips for successful login:"));
    console.log(
      chalk.yellow("1. Complete any CAPTCHA or verification challenges")
    );
    console.log(
      chalk.yellow("2. Make sure you're using the correct OpenAI account")
    );
    console.log(chalk.yellow("3. Try again with 'chatgpt login'"));
  }
}
