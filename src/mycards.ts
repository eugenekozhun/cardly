import { InlineKeyboard } from "grammy";
import { listCardsByOwner } from "./store.ts";
import { escapeHtml, statusLabel } from "./templates.ts";
import { mainMenuKeyboard } from "./keyboards.ts";
import type { MyContext } from "./conversations.ts";

export async function showMyCards(ctx: MyContext): Promise<void> {
  const from = ctx.from;
  if (!from) return;
  const cards = await listCardsByOwner(from.id);
  if (cards.length === 0) {
    await ctx.reply("У вас пока нет открыток. Создайте первую!", {
      reply_markup: mainMenuKeyboard(),
    });
    return;
  }
  const lines = cards.map((card, idx) => {
    const preview = card.text.length > 40
      ? card.text.slice(0, 40) + "…"
      : card.text;
    return `${idx + 1}. ${statusLabel(card)} ${escapeHtml(preview)}`;
  });
  const kb = new InlineKeyboard();
  cards.slice(0, 10).forEach((card, idx) => {
    kb.text(`🗑 ${idx + 1}`, `del:${card.id}`);
    if (idx % 5 === 4) kb.row();
  });
  kb.row().switchInline("📤 Отправить открытку", "");
  await ctx.reply(`📋 <b>Мои открытки</b>\n\n${lines.join("\n")}`, {
    parse_mode: "HTML",
    reply_markup: kb,
  });
}
