# ChatGPT CLI

A command-line interface for interacting with ChatGPT directly from your terminal.

## Features

- Authenticate with ChatGPT using your browser
- Capture and store session data for future use
- Chat with ChatGPT directly from your terminal
- Markdown rendering of ChatGPT responses

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Install from source

1. Clone this repository:

   ```
   git clone https://github.com/yourusername/chatgpt-cli.git
   cd chatgpt-cli
   ```

2. Run the install script:
   ```
   ./install.sh
   ```

Or manually:

1. Install dependencies:

   ```
   npm install
   ```

2. Link the CLI globally:
   ```
   npm link
   ```

## Usage

### Login

Before using the CLI, you need to authenticate with ChatGPT:

```
chatgpt login
```

This will connect to your existing Chrome browser (if available) or launch a new Chrome instance. It will open a new tab where you can log in to your ChatGPT account. The tool uses your existing Chrome installation and user profile, so you might already be logged in.

**Important:** You must complete the entire login process, including any CAPTCHA or other human verification challenges. The CLI will wait for up to 5 minutes for you to complete this process. You need to fully log in until you see the ChatGPT interface (either at chat.openai.com or chatgpt.com) - the tool will detect when you've successfully logged in and capture the necessary session data.

The tool checks for authentication cookies such as the session token, PUID, and Cloudflare clearance cookies. It's flexible about which cookies are required - either the session token OR both the PUID and Cloudflare clearance cookies are sufficient for authentication. It validates that these cookies exist and are not expired. These cookies are often HttpOnly and not accessible via JavaScript, which is why the tool needs to use Chrome's DevTools Protocol to access them.

**Troubleshooting Login Issues:**

If you encounter login problems:

1. Make sure you complete the entire login process until you see the ChatGPT interface
2. Ensure you're using the correct OpenAI account credentials
3. Complete any verification challenges that appear
4. If you see a message about missing cookies, it means you didn't fully complete the login process
5. If the login times out, try running `chatgpt login` again
6. Check that you have a stable internet connection
7. Try clearing your browser cookies and cache if you continue to have issues
8. Use the `./start-chrome.sh` script to start Chrome with debugging enabled before running `chatgpt login`
9. If you're still having issues with the session token cookie, the tool can work with just the PUID and CF clearance cookies
10. Check the `session.json` file in the current directory to see which cookies were captured

### Chat

Start a chat session with ChatGPT:

```
chatgpt chat
```

Or simply:

```
chatgpt
```

Type your messages and press Enter to send. ChatGPT's responses will be displayed in the terminal with Markdown formatting.

Type `exit` to end the chat session.

## How it works

The CLI connects to your existing Chrome browser (if it's running with remote debugging enabled) or launches a new Chrome instance. It opens a new tab for authentication with ChatGPT and connects to it via the Chrome DevTools Protocol to capture cookies and other necessary data needed to interact with the ChatGPT API. This approach preserves your login state and avoids having to log in multiple times. The session data is stored locally in the `~/.chatgpt-cli` directory and also in the current directory.

### Using an existing Chrome instance (recommended)

To use an existing Chrome instance, you need to start Chrome with the `--remote-debugging-port` flag. This is the **recommended approach** as it allows the CLI to open new tabs in your existing Chrome window rather than launching a new Chrome instance each time.

Use the included script to start Chrome with debugging enabled:

```
./start-chrome.sh
```

This script will:

1. Check if Chrome is already running with the debugging port
2. If not, start Chrome with the debugging port enabled
3. Provide clear instructions on next steps

Or manually start Chrome with the flag:

```
chrome --remote-debugging-port=9222
```

If Chrome is not already running with this flag, the tool will launch a new Chrome instance.

### Session data and cookies

The tool saves two important files:

- `session.json`: Contains cookies and user agent information
- `headers.json`: Contains HTTP headers needed for API requests

These files are saved both in the `~/.chatgpt-cli` directory and in the current directory. You can use the files in the current directory to debug any issues with the session.

#### Cookie handling

The tool is designed to work with different combinations of authentication cookies:

- It will try to capture the `__Secure-next-auth.session-token` cookie
- If that cookie is not available, it will use the `_puid` and `cf_clearance` cookies as an alternative
- The tool includes multiple retry mechanisms and different methods to capture these cookies
- To avoid the "Request Header Or Cookie Too Large" error, the tool only sends essential cookies to the API

#### Common issues

**Request Header Or Cookie Too Large error**

If you see this error, it means that the cookies being sent to the ChatGPT API are too large. The tool attempts to mitigate this by filtering cookies, but if you still encounter this issue:

1. Clear your browser cookies or use a fresh Chrome profile
2. Run `./start-chrome.sh` to start Chrome with debugging enabled
3. Run `chatgpt login` to authenticate again

**Cloudflare challenge detected**

If you see a Cloudflare challenge error (403 with Cloudflare HTML in the response), it means that Cloudflare is blocking the request because it detected automated access:

1. The tool will automatically retry the request a few times with a delay
2. If it still fails, run `chatgpt login` again to refresh your session
3. Make sure you have the Cloudflare clearance cookie (`cf_clearance`)
4. Try using a different model (the tool now uses `gpt-3.5-turbo` by default which is more reliable)

**Authentication failed error**

If you see an authentication error (401 or 403), your session may have expired. Run `chatgpt login` again to refresh your session.

## License

ISC
