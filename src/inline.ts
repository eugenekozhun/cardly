import { type Bot, InlineQueryResultBuilder } from "grammy";
import { getCard, listCardsByOwner, updateCard } from "./store.ts";
import { renderCard } from "./templates.ts";
import { rsvpKeyboard } from "./keyboards.ts";
import type { MyContext } from "./conversations.ts";

const RESULT_ID_PREFIX = "card:";
const MAX_RESULTS = 30;

export function registerInlineHandlers(bot: Bot<MyContext>): void {
  bot.on("inline_query", async (ctx) => {
    const cards = await listCardsByOwner(ctx.from.id);
    const results = cards.slice(0, MAX_RESULTS).map((card) =>
      InlineQueryResultBuilder.article(
        `${RESULT_ID_PREFIX}${card.id}`,
        card.kind === "simple" ? "💌 Открытка" : "✉️ Приглашение",
        {
          description: card.text.slice(0, 60),
          ...(card.kind === "invite"
            ? { reply_markup: rsvpKeyboard(card.id) }
            : {}),
        },
      ).text(renderCard(card), { parse_mode: "HTML" })
    );
    await ctx.answerInlineQuery(results, {
      cache_time: 0,
      ...(cards.length === 0
        ? {
          button: {
            text: "🎁 Создать первую открытку",
            start_parameter: "new",
          },
        }
        : {}),
    });
  });

  bot.on("chosen_inline_result", async (ctx) => {
    const { result_id, inline_message_id } = ctx.chosenInlineResult;
    if (!inline_message_id || !result_id.startsWith(RESULT_ID_PREFIX)) return;
    const card = await getCard(result_id.slice(RESULT_ID_PREFIX.length));
    if (!card) return;
    card.inlineMessageId = inline_message_id;
    await updateCard(card);
  });
}
