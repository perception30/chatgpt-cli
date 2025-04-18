#!/bin/bash

# Install dependencies
echo "Installing dependencies..."
npm install

# Make the CLI globally available
echo "Making the CLI globally available..."
npm link

echo "Installation complete! You can now use the 'chatgpt' command."
echo "To get started, run: chatgpt login"
