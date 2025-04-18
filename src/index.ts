#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { login } from "./commands/login.js";
import { chat } from "./commands/chat.js";
import { checkSession } from "./utils/session.js";

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
    if (await checkSession()) {
      await chat();
    } else {
      console.log(chalk.red("You need to login first. Run: chatgpt login"));
    }
  });

// Default command (if no command is specified)
if (process.argv.length === 2) {
  process.argv.push("chat");
}

program.parse(process.argv);
