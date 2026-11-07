import { InlineKeyboard } from "grammy";
import { type Card, listCardsByOwner } from "./store.ts";
import { escapeHtml, statusLabel } from "./templates.ts";
import type { MyContext } from "./conversations.ts";

const MAX_DELETE_BUTTONS = 10;

export function myCardsContent(cards: Card[]): {
  text: string;
  keyboard: InlineKeyboard;
} {
  if (cards.length === 0) {
    return {
      text: "У вас пока нет открыток. Создайте первую!",
      keyboard: new InlineKeyboard()
        .text("🎁 Новая открытка", "menu:new")
        .row()
        .text("« Назад", "nav:menu"),
    };
  }
  const lines = cards.map((card, idx) => {
    const preview = card.text.length > 40
      ? card.text.slice(0, 40) + "…"
      : card.text;
    const audience = card.audience === "group" ? "👥" : "👤";
    return `${idx + 1}. ${statusLabel(card)} ${audience} ${escapeHtml(preview)}`;
  });
  const kb = new InlineKeyboard();
  cards.slice(0, MAX_DELETE_BUTTONS).forEach((card, idx) => {
    kb.text(`🗑 ${idx + 1}`, `del:${card.id}`);
    if (idx % 5 === 4) kb.row();
  });
  kb.row()
    .switchInline("📤 Отправить открытку", "")
    .row()
    .text("« Назад", "nav:menu");
  return {
    text: `📋 <b>Мои открытки</b>\n\n${lines.join("\n")}`,
    keyboard: kb,
  };
}

/** Редактирует текущее сообщение, если вызвано кнопкой, иначе отправляет новое. */
export async function showMyCards(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const { text, keyboard } = myCardsContent(await listCardsByOwner(from.id));
  if (ctx.callbackQuery?.message) {
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } else {
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
  }
}
