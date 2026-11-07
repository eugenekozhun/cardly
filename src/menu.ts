import { mainMenuKeyboard } from "./keyboards.ts";
import type { MyContext } from "./conversations.ts";

export const MAIN_MENU_TEXT =
  "Привет! Я CardlyBot — помогаю собрать открытку или приглашение и отправить его другу от вашего имени.\n\nВыберите действие:";

/** Показывает главное меню: редактирует текущее сообщение, если вызвано кнопкой, иначе отправляет новое. */
export async function showMainMenu(ctx: MyContext): Promise<void> {
  if (ctx.callbackQuery?.message) {
    await ctx.editMessageText(MAIN_MENU_TEXT, {
      reply_markup: mainMenuKeyboard(),
    });
  } else {
    await ctx.reply(MAIN_MENU_TEXT, { reply_markup: mainMenuKeyboard() });
  }
}
