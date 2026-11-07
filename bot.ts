import { Bot } from "grammy";

const bot = new Bot(Deno.env.get("BOT_TOKEN"));

bot.command("start", (ctx) => ctx.reply("Welcome! Up and running."));
bot.on("message", (ctx) => ctx.reply("Got another message!"));

bot.start();
