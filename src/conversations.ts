import { type Context, GrammyError, type InlineKeyboard, type SessionFlavor } from "grammy";
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
  afterSaveKeyboard,
  cancelKeyboard,
  mainMenuKeyboard,
  previewKeyboard,
  slotsInputKeyboard,
  templateKeyboard,
} from "./keyboards.ts";
import { MAIN_MENU_TEXT } from "./menu.ts";

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

/** Правит «живое» сообщение-меню; игнорирует «message is not modified». */
async function editMenuMessage(
  ctx: MyContext,
  chatId: number,
  messageId: number,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  try {
    await ctx.api.editMessageText(chatId, messageId, text, {
      parse_mode: "HTML",
      ...(keyboard ? { reply_markup: keyboard } : {}),
    });
  } catch (error) {
    if (error instanceof GrammyError && error.error_code === 400) return;
    throw error;
  }
}

export async function createCardConversation(
  conversation: MyConversation,
  ctx: MyContext,
): Promise<void> {
  const from = ctx.from;
  const chatId = ctx.chat?.id;
  if (!from || !chatId) return;

  // Если вошли кнопкой меню — превращаем её сообщение в меню конструктора,
  // иначе (/new) отправляем новое.
  let menuMsgId: number;
  const menuMessage = ctx.callbackQuery?.data === "menu:new"
    ? ctx.callbackQuery.message
    : undefined;
  if (menuMessage) {
    menuMsgId = menuMessage.message_id;
    await editMenuMessage(
      ctx,
      chatId,
      menuMsgId,
      "Какую открытку делаем?",
      templateKeyboard(),
    );
  } else {
    const sent = await ctx.reply("Какую открытку делаем?", {
      reply_markup: templateKeyboard(),
    });
    menuMsgId = sent.message_id;
  }

  const editMenu = (text: string, keyboard?: InlineKeyboard) =>
    editMenuMessage(ctx, chatId, menuMsgId, text, keyboard);

  // Id сообщений пользователя с вводом — удаляем их из чата в конце,
  // чтобы не копились (бот может удалять входящие в личке до 48 часов).
  const userMsgIds: number[] = [];
  if (!menuMessage && ctx.msg?.text?.startsWith("/new")) {
    userMsgIds.push(ctx.msg.message_id);
  }
  const cleanupInputs = () =>
    conversation.external(async () => {
      for (const id of userMsgIds) {
        await ctx.api.deleteMessage(chatId, id).catch(() => {});
      }
    });

  // Ожидание текстового ввода с валидацией и возможностью отмены.
  // Возвращает null при отмене.
  const waitText = async (
    invalidPrompt: string,
    validate: (value: string) => boolean,
  ): Promise<{ text: string } | null> => {
    for (;;) {
      const input = await conversation.wait();
      if (input.callbackQuery?.data === "nav:cancel") {
        await input.answerCallbackQuery();
        await cleanupInputs();
        await editMenu(MAIN_MENU_TEXT, mainMenuKeyboard());
        return null;
      }
      if (input.msg) userMsgIds.push(input.msg.message_id);
      const value = input.msg?.text?.trim();
      if (value && validate(value)) return { text: value };
      await editMenu(invalidPrompt, cancelKeyboard());
    }
  };

  for (;;) {
    const tplCtx = await conversation.waitForCallbackQuery([
      "tpl:simple",
      "tpl:invite",
      "nav:cancel",
    ]);
    await tplCtx.answerCallbackQuery();
    if (tplCtx.callbackQuery.data === "nav:cancel") {
      await cleanupInputs();
      await editMenu(MAIN_MENU_TEXT, mainMenuKeyboard());
      return;
    }
    const kind: CardKind = tplCtx.callbackQuery.data === "tpl:simple"
      ? "simple"
      : "invite";

    await editMenu(
      `Введите текст открытки (до ${MAX_TEXT_LENGTH} символов):`,
      cancelKeyboard(),
    );
    const textInput = await waitText(
      `Нужен текст от 1 до ${MAX_TEXT_LENGTH} символов. Попробуйте ещё раз:`,
      (value) => value.length <= MAX_TEXT_LENGTH,
    );
    if (!textInput) return;

    let time: string | undefined;
    const altSlots: string[] = [];
    if (kind === "invite") {
      await editMenu(
        "Когда? Напишите основное время, например: «сб, 19:00».",
        cancelKeyboard(),
      );
      const timeInput = await waitText(
        "Напишите время текстом, например: «сб, 19:00».",
        () => true,
      );
      if (!timeInput) return;
      time = timeInput.text;

      while (altSlots.length < MAX_ALT_SLOTS) {
        await editMenu(
          `Добавьте запасной вариант времени (${altSlots.length}/${MAX_ALT_SLOTS}) или нажмите «Готово»:`,
          slotsInputKeyboard(),
        );
        const input = await conversation.wait();
        if (input.callbackQuery?.data === "slots:done") {
          await input.answerCallbackQuery();
          break;
        }
        if (input.callbackQuery?.data === "nav:cancel") {
          await input.answerCallbackQuery();
          await cleanupInputs();
          await editMenu(MAIN_MENU_TEXT, mainMenuKeyboard());
          return;
        }
        if (input.msg) userMsgIds.push(input.msg.message_id);
        const slot = input.msg?.text?.trim();
        if (slot) altSlots.push(slot);
      }
    }

    const cardId = await conversation.external(() =>
      Promise.resolve(generateCardId())
    );
    const card: Card = {
      id: cardId,
      ownerId: from.id,
      ownerName: displayName(from),
      kind,
      audience: "personal",
      text: textInput.text,
      time,
      altSlots,
      rsvp: { status: "pending" },
    };

    await editMenu("Вот превью:\n\n" + renderCard(card), previewKeyboard());
    const decision = await conversation.waitForCallbackQuery([
      "pv:save",
      "pv:restart",
      "nav:cancel",
    ]);
    await decision.answerCallbackQuery();

    if (decision.callbackQuery.data === "nav:cancel") {
      await cleanupInputs();
      await editMenu(MAIN_MENU_TEXT, mainMenuKeyboard());
      return;
    }
    if (decision.callbackQuery.data === "pv:save") {
      await conversation.external(() => saveCard(card));
      await cleanupInputs();
      await editMenu(
        "✅ Открытка сохранена! Нажмите «Отправить другу» — или вернитесь в меню:",
        afterSaveKeyboard(),
      );
      return;
    }
    await cleanupInputs();
    userMsgIds.length = 0;
    await editMenu("Какую открытку делаем?", templateKeyboard());
  }
}
