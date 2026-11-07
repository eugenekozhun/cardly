import { Bot, session } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import {
  createCardConversation,
  type MyContext,
  type SessionData,
} from "./src/conversations.ts";
import { registerInlineHandlers } from "./src/inline.ts";
import { registerRsvpHandlers } from "./src/rsvp.ts";
import { myCardsContent, showMyCards } from "./src/mycards.ts";
import { showMainMenu } from "./src/menu.ts";
import { deleteCard, listCardsByOwner } from "./src/store.ts";

const token = Deno.env.get("BOT_TOKEN");
if (!token) throw new Error("BOT_TOKEN не задан в окружении");

const bot = new Bot<MyContext>(token);

bot.use(session({ initial: (): SessionData => ({}) }));
bot.use(conversations());
bot.use(createConversation(createCardConversation, "createCard"));

bot.command("start", showMainMenu);
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

bot.callbackQuery("nav:menu", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showMainMenu(ctx);
});

// Отмена вне активного диалога (устаревшая кнопка) — просто показываем меню
bot.callbackQuery("nav:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showMainMenu(ctx);
});

bot.callbackQuery(/^del:(.+)$/, async (ctx) => {
  await deleteCard(ctx.match[1], ctx.from.id);
  await ctx.answerCallbackQuery({ text: "Открытка удалена" });
  const { text, keyboard } = myCardsContent(
    await listCardsByOwner(ctx.from.id),
  );
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
});

registerInlineHandlers(bot);
registerRsvpHandlers(bot);

bot.catch((err) => {
  console.error(
    `Ошибка при обработке update ${err.ctx.update.update_id}:`,
    err.error,
  );
});

// Команды для кнопки Menu (≡) рядом с полем ввода
await bot.api.setMyCommands([
  { command: "start", description: "Главное меню" },
  { command: "new", description: "Новая открытка" },
  { command: "my", description: "Мои открытки" },
]);

bot.start();
