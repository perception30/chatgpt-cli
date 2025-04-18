#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { login } from "./commands/login.js";
import { chat } from "./commands/chat.js";
import { diagnose } from "./commands/diagnose.js";
import { checkSession, saveToCurrentDir } from "./utils/session.js";
import { AuthHelper } from "./utils/auth-helper.js";

const program = new Command();

program
  .name("chatgpt")
  .description("ChatGPT CLI - Interact with ChatGPT from your terminal")
  .version("1.0.0");

program
  .command("login")
  .description("Login to ChatGPT and save session")
  .action(login);

program
  .command("chat")
  .description("Start a chat session with ChatGPT")
  .action(async () => {
    // Try to use AuthHelper first, fall back to checkSession if that fails
    const session = AuthHelper.loadSession();
    let isValid = false;

    if (session) {
      isValid = await AuthHelper.validateSession(session);
    }

    // If AuthHelper validation fails, try the old method as fallback
    if (!isValid) {
      isValid = await checkSession();
    }

    if (isValid) {
      await chat();
    } else {
      console.log(chalk.red("You need to login first. Run: chatgpt login"));
    }
  });

program
  .command("save-local")
  .description("Save session and headers to current directory")
  .action(() => {
    if (saveToCurrentDir()) {
      console.log(
        chalk.green("Session and headers saved to current directory")
      );
    } else {
      console.log(
        chalk.red("Failed to save session and headers to current directory")
      );
    }
  });

program
  .command("check")
  .description("Check if your session is valid")
  .action(async () => {
    const session = AuthHelper.loadSession();
    if (!session) {
      console.log(chalk.red("No session found. Please login first."));
      return;
    }

    const isValid = await AuthHelper.validateSession(session);
    if (isValid) {
      console.log(
        chalk.green("Your session is valid. You can use ChatGPT CLI.")
      );
    } else {
      console.log(
        chalk.red("Your session is invalid or expired. Please login again.")
      );
    }
  });

program
  .command("diagnose")
  .description("Diagnose authentication issues and provide solutions")
  .action(diagnose);

// Default command (if no command is specified)
if (process.argv.length === 2) {
  process.argv.push("chat");
}

program.parse(process.argv);
