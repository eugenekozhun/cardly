import { type Bot, InlineQueryResultBuilder } from "grammy";
import { type Card, getCard, listCardsByOwner, updateCard } from "./store.ts";
import { renderCard } from "./templates.ts";
import { rsvpKeyboard } from "./keyboards.ts";
import type { MyContext } from "./conversations.ts";

const RESULT_ID_PREFIX = "card:";
const MAX_RESULTS = 30;

// chat_type: "private" — личка (и Избранное); "group"/"supergroup"/"channel" — группы и каналы;
// "sender"/отсутствует — клиент не сообщил тип, показываем всё.
function fitsChat(cardAudience: Card["audience"], chatType?: string): boolean {
  if (!chatType || chatType === "sender") return true;
  const audience = cardAudience ?? "personal";
  return chatType === "private"
    ? audience === "personal"
    : audience === "group";
}

export function registerInlineHandlers(bot: Bot<MyContext>): void {
  bot.on("inline_query", async (ctx) => {
    const chatType = ctx.inlineQuery.chat_type;
    const all = await listCardsByOwner(ctx.from.id);
    const cards = all.filter((card) => fitsChat(card.audience, chatType));
    const results = cards.slice(0, MAX_RESULTS).map((card) =>
      InlineQueryResultBuilder.article(
        `${RESULT_ID_PREFIX}${card.id}`,
        `${card.audience === "group" ? "👥" : "👤"} ${
          card.kind === "simple" ? "💌 Открытка" : "✉️ Приглашение"
        }`,
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
      ...(all.length === 0
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
