import type { Bot, InlineKeyboard } from "grammy";
import type { Card } from "./store.ts";
import type { MyContext } from "./conversations.ts";

export async function notifyOwner(
  bot: Bot<MyContext>,
  card: Card,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  try {
    await bot.api.sendMessage(card.ownerId, text, {
      ...(keyboard ? { reply_markup: keyboard } : {}),
    });
  } catch (error) {
    console.error(`Не удалось уведомить владельца ${card.ownerId}:`, error);
  }
}
