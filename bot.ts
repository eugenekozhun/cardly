import { Bot, session } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import {
  createCardConversation,
  type MyContext,
  type SessionData,
} from "./src/conversations.ts";
import { registerInlineHandlers } from "./src/inline.ts";
import { registerRsvpHandlers } from "./src/rsvp.ts";
import { showMyCards } from "./src/mycards.ts";
import { mainMenuKeyboard } from "./src/keyboards.ts";
import { deleteCard } from "./src/store.ts";

const token = Deno.env.get("BOT_TOKEN");
if (!token) throw new Error("BOT_TOKEN не задан в окружении");

const bot = new Bot<MyContext>(token);

bot.use(session({ initial: (): SessionData => ({}) }));
bot.use(conversations());
bot.use(createConversation(createCardConversation, "createCard"));

bot.command("start", (ctx) =>
  ctx.reply(
    "Привет! Я CardlyBot — помогаю собрать открытку или приглашение и отправить его другу от вашего имени.",
    { reply_markup: mainMenuKeyboard() },
  )
);

bot.command("new", (ctx) => ctx.conversation.enter("createCard"));
bot.command("my", showMyCards);

bot.callbackQuery("menu:new", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.conversation.enter("createCard");
});

bot.callbackQuery("menu:my", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showMyCards(ctx);
});

bot.callbackQuery(/^del:(.+)$/, async (ctx) => {
  await deleteCard(ctx.match[1], ctx.from.id);
  await ctx.answerCallbackQuery({ text: "Открытка удалена" });
  await ctx.editMessageText("Открытка удалена. Обновить список: /my");
});

registerInlineHandlers(bot);
registerRsvpHandlers(bot);

bot.catch((err) => {
  console.error(`Ошибка при обработке update ${err.ctx.update.update_id}:`, err.error);
});

bot.start();
