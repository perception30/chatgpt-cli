# ChatGPT CLI

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/perception30/chatgpt-cli)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/node-%3E%3D14-brightgreen.svg)](https://nodejs.org/)

A powerful command-line interface for interacting with ChatGPT directly from your terminal. This tool allows you to have seamless conversations with ChatGPT without leaving your development environment.

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
- [How It Works](#-how-it-works)
- [Troubleshooting](#️-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)
- [Contact](#-contact)

## ✨ Features

- **Browser-Based Authentication**: Securely authenticate with ChatGPT using your existing browser session
- **Session Management**: Capture and store session data for future use without frequent re-logins
- **Terminal Chat Interface**: Chat with ChatGPT directly from your terminal
- **Markdown Rendering**: Beautiful rendering of ChatGPT responses with full Markdown support
- **Persistent Sessions**: Maintains your login state between sessions
- **Flexible Authentication**: Works with different combinations of authentication cookies

## 🚀 Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Google Chrome browser

### Install from Source

1. Clone this repository:

   ```bash
   git clone https://github.com/perception30/chatgpt-cli.git
   cd chatgpt-cli
   ```

2. Run the install script:
   ```bash
   ./install.sh
   ```

### Manual Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the project:

   ```bash
   npm run build
   ```

3. Link the CLI globally:
   ```bash
   npm link
   ```

## 🔧 Usage

### Starting Chrome with Debugging Enabled

For the best experience, start Chrome with debugging enabled before using the CLI:

```bash
./start-chrome.sh
```

This allows the CLI to connect to your existing Chrome instance rather than launching a new one each time.

### Login

Before using the CLI, you need to authenticate with ChatGPT:

```bash
chatgpt login
```

This will connect to your existing Chrome browser (if available) or launch a new Chrome instance. It will open a new tab where you can log in to your ChatGPT account.

**Important:** You must complete the entire login process, including any CAPTCHA or verification challenges. The CLI will wait for up to 5 minutes for you to complete this process.

### Chat

Start a chat session with ChatGPT:

```bash
chatgpt chat
```

Or simply:

```bash
chatgpt
```

Type your messages and press Enter to send. ChatGPT's responses will be displayed in the terminal with Markdown formatting.

Type `exit` to end the chat session.

### Additional Commands

```bash
# Check if your session is valid
chatgpt check

# Save session data to current directory (useful for debugging)
chatgpt save-local

# Diagnose authentication issues
chatgpt diagnose
```

## 🔍 How It Works

The CLI connects to your existing Chrome browser (if it's running with remote debugging enabled) or launches a new Chrome instance. It uses the Chrome DevTools Protocol to:

1. Open a new tab for authentication with ChatGPT
2. Capture authentication cookies and session data
3. Use these credentials to interact with the ChatGPT API

This approach preserves your login state and avoids having to log in multiple times. The session data is stored locally in the `~/.chatgpt-cli` directory and also in the current directory.

### Using an Existing Chrome Instance (Recommended)

To use an existing Chrome instance, start Chrome with the `--remote-debugging-port` flag:

```bash
./start-chrome.sh
```

This script will:

1. Check if Chrome is already running with the debugging port
2. If not, start Chrome with the debugging port enabled
3. Provide clear instructions on next steps

### Session Data and Cookies

The tool saves two important files:

- `session.json`: Contains cookies and user agent information
- `headers.json`: Contains HTTP headers needed for API requests

These files are saved both in the `~/.chatgpt-cli` directory and in the current directory.

### Authentication Methods

The tool is designed to work with different combinations of authentication cookies:

- Primary method: Capture the `__Secure-next-auth.session-token` cookie
- Alternative method: Use the `_puid` and `cf_clearance` cookies

## 🛠️ Troubleshooting

### Login Issues

If you encounter login problems:

1. Make sure you complete the entire login process until you see the ChatGPT interface
2. Ensure you're using the correct OpenAI account credentials
3. Complete any verification challenges that appear
4. If the login times out, try running `chatgpt login` again
5. Use the `./start-chrome.sh` script to start Chrome with debugging enabled
6. Check the `session.json` file to see which cookies were captured

### Common Errors

**Request Header Or Cookie Too Large**

If you see this error:

1. Clear your browser cookies or use a fresh Chrome profile
2. Run `./start-chrome.sh` to start Chrome with debugging enabled
3. Run `chatgpt login` to authenticate again

**Cloudflare Challenge Detected**

If you see a Cloudflare challenge error (403):

1. Run `chatgpt login` again to refresh your session
2. Make sure you have the Cloudflare clearance cookie (`cf_clearance`)

**Authentication Failed**

If you see an authentication error (401 or 403), run `chatgpt login` again to refresh your session.

## 👥 Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 📬 Contact

Khaled - [@perception30](https://github.com/perception30)

Project Link: [https://github.com/perception30/chatgpt-cli](https://github.com/perception30/chatgpt-cli)
