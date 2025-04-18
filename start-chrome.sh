#!/bin/bash

# Print header
echo "=================================================="
echo "ChatGPT CLI - Chrome Launcher with Debugging Port"
echo "=================================================="
echo ""

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CHROME_PATH=$(which google-chrome || which chrome || which chromium-browser)
else
    # Windows (Git Bash or similar)
    CHROME_PATH="/c/Program Files/Google/Chrome/Application/chrome.exe"
    if [ ! -f "$CHROME_PATH" ]; then
        CHROME_PATH="/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
    fi
fi

# Check if Chrome exists
if [ ! -f "$CHROME_PATH" ] && [ "$OSTYPE" != "linux-gnu"* ]; then
    echo "❌ Chrome not found at $CHROME_PATH"
    echo "Please install Chrome or update this script with the correct path"
    exit 1
fi

# Check if Chrome is already running with debugging port
PORT=9222
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    RUNNING_CHROME=$(ps -ax | grep "Google Chrome" | grep "remote-debugging-port=$PORT" | grep -v grep)
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    RUNNING_CHROME=$(ps -ax | grep "chrome" | grep "remote-debugging-port=$PORT" | grep -v grep)
else
    # Windows
    RUNNING_CHROME=$(wmic process where "name='chrome.exe'" get commandline | findstr "remote-debugging-port=$PORT")
fi

if [ -n "$RUNNING_CHROME" ]; then
    echo "✅ Chrome is already running with debugging port $PORT"
    echo "You can now run 'chatgpt login' to connect to this Chrome instance."
    exit 0
fi

# Start Chrome with remote debugging enabled
echo "🚀 Starting Chrome with remote debugging enabled on port $PORT..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - use open to avoid terminal staying open
    open -a "Google Chrome" --args --remote-debugging-port=$PORT
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - start in background
    "$CHROME_PATH" --remote-debugging-port=$PORT &
else
    # Windows - start in background
    "$CHROME_PATH" --remote-debugging-port=$PORT &
fi

echo "✅ Chrome started with remote debugging enabled."
echo "You can now run 'chatgpt login' to connect to this Chrome instance."
echo ""
echo "Note: This Chrome instance will be used by the ChatGPT CLI tool."
echo "It will open a new tab instead of launching a new Chrome window each time."
echo "This helps maintain your login session across multiple uses of the CLI."
