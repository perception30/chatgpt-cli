import inquirer from "inquirer";
import chalk from "chalk";
import ora from "ora";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";
import { sendMessage } from "../utils/api.js";
import { ChatMessage } from "../types/index.js";

// Configure marked with terminal renderer
marked.setOptions({
  // @ts-ignore - Type definitions are not up to date
  renderer: new TerminalRenderer(),
});

export async function chat(): Promise<void> {
  console.log(
    chalk.green('ChatGPT CLI - Start chatting (type "exit" to quit)')
  );
  console.log(chalk.dim("---------------------------------------------------"));

  let conversationId: string | undefined;
  const history: ChatMessage[] = [];

  while (true) {
    // Get user input
    const { message } = await inquirer.prompt({
      type: "input",
      name: "message",
      message: chalk.blue("> You:"),
    });

    // Exit if user types 'exit'
    if (message.toLowerCase() === "exit") {
      console.log(chalk.yellow("Goodbye!"));
      break;
    }

    // Add user message to history
    history.push({ role: "user", content: message });

    // Show spinner while waiting for response
    const spinner = ora("ChatGPT is thinking...").start();

    try {
      // Send message to ChatGPT
      const response = await sendMessage(message, conversationId);

      // Stop spinner
      spinner.stop();

      if (response.error) {
        console.log(chalk.red(`Error: ${response.error}`));
        continue;
      }

      // Update conversation ID
      conversationId = response.conversationId;

      // Add assistant message to history
      history.push(response.message);

      // Display the response
      console.log(chalk.green("\nChatGPT:"));
      console.log(marked(response.message.content));
      console.log(); // Empty line for better readability
    } catch (error: any) {
      spinner.fail(`Error: ${error.message}`);
    }
  }
}
