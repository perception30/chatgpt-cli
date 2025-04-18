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

This will open a new tab in your existing Chrome browser where you can log in to your ChatGPT account. The tool uses your existing Chrome installation and user profile, so you might already be logged in.

**Important:** You must complete the entire login process, including any CAPTCHA or other human verification challenges. The CLI will wait for up to 5 minutes for you to complete this process. You need to fully log in until you see the ChatGPT interface (either at chat.openai.com or chatgpt.com) - the tool will detect when you've successfully logged in and capture the necessary session data.

The tool checks for essential cookies that are required for authentication. These cookies are often HttpOnly and not accessible via JavaScript, which is why the tool needs to use Chrome's DevTools Protocol to access them.

**Troubleshooting Login Issues:**

If you encounter login problems:

1. Make sure you complete the entire login process until you see the ChatGPT interface
2. Ensure you're using the correct OpenAI account credentials
3. Complete any verification challenges that appear
4. If you see a message about missing cookies, it means you didn't fully complete the login process
5. If the login times out, try running `chatgpt login` again
6. Check that you have a stable internet connection
7. Try clearing your browser cookies and cache if you continue to have issues

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

The CLI uses your existing Chrome browser for authentication with ChatGPT. It opens a new tab in your existing Chrome browser and connects to it via the Chrome DevTools Protocol to capture cookies and other necessary data needed to interact with the ChatGPT API. This approach preserves your login state and avoids having to log in multiple times. The session data is stored locally in the `~/.chatgpt-cli` directory.

## License

ISC
