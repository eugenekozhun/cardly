import type { Context, SessionFlavor } from "grammy";
import {
  type Conversation,
  type ConversationFlavor,
} from "@grammyjs/conversations";
import {
  type Card,
  type CardKind,
  generateCardId,
  saveCard,
} from "./store.ts";
import { renderCard } from "./templates.ts";
import {
  previewKeyboard,
  sendKeyboard,
  slotsDoneKeyboard,
  templateKeyboard,
} from "./keyboards.ts";

export type SessionData = Record<string, never>;
export type MyContext = Context & SessionFlavor<SessionData> &
  ConversationFlavor<Context>;
export type MyConversation = Conversation<MyContext, MyContext>;

const MAX_TEXT_LENGTH = 500;
const MAX_ALT_SLOTS = 3;

export function displayName(from: {
  first_name: string;
  last_name?: string;
  username?: string;
}): string {
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ")
    .trim();
  return name || (from.username ? `@${from.username}` : "друг");
}

export async function createCardConversation(
  conversation: MyConversation,
  ctx: MyContext,
): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  await ctx.reply("Какую открытку делаем?", {
    reply_markup: templateKeyboard(),
  });
  const tplCtx = await conversation.waitForCallbackQuery([
    "tpl:simple",
    "tpl:invite",
  ]);
  await tplCtx.answerCallbackQuery();
  const kind: CardKind = tplCtx.callbackQuery.data === "tpl:simple"
    ? "simple"
    : "invite";

  await ctx.reply(
    `Введите текст открытки (до ${MAX_TEXT_LENGTH} символов):`,
  );
  let text = "";
  for (;;) {
    const textCtx = await conversation.waitFor("msg:text");
    const value = textCtx.msg.text.trim();
    if (value.length > 0 && value.length <= MAX_TEXT_LENGTH) {
      text = value;
      break;
    }
    await ctx.reply(
      value.length === 0
        ? "Текст пустой, попробуйте ещё раз:"
        : `Слишком длинно (больше ${MAX_TEXT_LENGTH} символов). Попробуйте короче:`,
    );
  }

  let time: string | undefined;
  const altSlots: string[] = [];
  if (kind === "invite") {
    await ctx.reply(
      "Когда? Напишите основное время, например: «сб, 19:00».",
    );
    time = (await conversation.waitFor("msg:text")).msg.text.trim();

    while (altSlots.length < MAX_ALT_SLOTS) {
      await ctx.reply(
        `Добавьте запасной вариант времени (${altSlots.length}/${MAX_ALT_SLOTS}) или нажмите «Готово»:`,
        { reply_markup: slotsDoneKeyboard() },
      );
      const slotCtx = await conversation.wait();
      if (slotCtx.callbackQuery?.data === "slots:done") {
        await slotCtx.answerCallbackQuery();
        break;
      }
      const slot = slotCtx.msg?.text?.trim();
      if (slot) altSlots.push(slot);
    }
  }

  const card: Card = {
    id: generateCardId(),
    ownerId: from.id,
    ownerName: displayName(from),
    kind,
    text,
    time,
    altSlots,
    rsvp: { status: "pending" },
  };

  await ctx.reply("Вот превью:\n\n" + renderCard(card), {
    parse_mode: "HTML",
    reply_markup: previewKeyboard(),
  });
  const decision = await conversation.waitForCallbackQuery([
    "pv:save",
    "pv:restart",
  ]);
  await decision.answerCallbackQuery();

  if (decision.callbackQuery.data === "pv:save") {
    await conversation.external(() => saveCard(card));
    await ctx.reply("Открытка сохранена! Теперь её можно отправить другу:", {
      reply_markup: sendKeyboard(),
    });
  } else {
    await ctx.reply("Хорошо, начнём заново — отправьте /new");
  }
}
