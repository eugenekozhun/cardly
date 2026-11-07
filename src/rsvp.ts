import type { Bot } from "grammy";
import { type Card, getCard, updateCard } from "./store.ts";
import { renderCard } from "./templates.ts";
import {
  counterConfirmKeyboard,
  rsvpKeyboard,
  slotsKeyboard,
} from "./keyboards.ts";
import { notifyOwner } from "./notify.ts";
import { displayName, type MyContext } from "./conversations.ts";

async function loadInviteCard(
  ctx: MyContext,
  id: string,
): Promise<Card | null> {
  const card = await getCard(id);
  if (!card || card.kind !== "invite") {
    await ctx.answerCallbackQuery({
      text: "Открытка не найдена или удалена",
      show_alert: true,
    });
    return null;
  }
  return card;
}

async function ensurePending(
  ctx: MyContext,
  card: Card,
): Promise<boolean> {
  if (card.rsvp.status === "pending") return true;
  await ctx.answerCallbackQuery({
    text: "Открытка уже закрыта",
    show_alert: true,
  });
  return false;
}

async function refreshInlineMessage(
  bot: Bot<MyContext>,
  card: Card,
): Promise<void> {
  if (!card.inlineMessageId) return;
  try {
    await bot.api.raw.editMessageText({
      inline_message_id: card.inlineMessageId,
      text: renderCard(card),
      parse_mode: "HTML",
    });
  } catch (error) {
    console.error(`Не удалось обновить сообщение открытки ${card.id}:`, error);
  }
}

export function registerRsvpHandlers(bot: Bot<MyContext>): void {
  // Принять приглашение
  bot.callbackQuery(/^a:(.+)$/, async (ctx) => {
    const card = await loadInviteCard(ctx, ctx.match[1]);
    if (!card || !(await ensurePending(ctx, card))) return;
    const by = { id: ctx.from.id, name: displayName(ctx.from) };
    card.rsvp = { status: "accepted", byUserId: by.id, byName: by.name };
    await updateCard(card);
    await ctx.editMessageText(renderCard(card), { parse_mode: "HTML" });
    await ctx.answerCallbackQuery({ text: "Вы приняли приглашение 🎉" });
    await notifyOwner(bot, card, `✅ ${by.name} принял(а) ваше приглашение!`);
  });

  // Показать запасные варианты времени
  bot.callbackQuery(/^t:(.+)$/, async (ctx) => {
    const card = await loadInviteCard(ctx, ctx.match[1]);
    if (!card || !(await ensurePending(ctx, card))) return;
    if (card.altSlots.length === 0) {
      await ctx.answerCallbackQuery({
        text: "Запасных вариантов нет — только принять или отклонить",
        show_alert: true,
      });
      return;
    }
    await ctx.editMessageReplyMarkup({ reply_markup: slotsKeyboard(card) });
    await ctx.answerCallbackQuery();
  });

  // Назад к основным кнопкам
  bot.callbackQuery(/^b:(.+)$/, async (ctx) => {
    const card = await loadInviteCard(ctx, ctx.match[1]);
    if (!card) return;
    await ctx.editMessageReplyMarkup({ reply_markup: rsvpKeyboard(card.id) });
    await ctx.answerCallbackQuery();
  });

  // Выбор запасного слота
  bot.callbackQuery(/^s:(.+):(\d+)$/, async (ctx) => {
    const card = await loadInviteCard(ctx, ctx.match[1]);
    if (!card || !(await ensurePending(ctx, card))) return;
    const slot = card.altSlots[Number(ctx.match[2])];
    if (slot === undefined) {
      await ctx.answerCallbackQuery({
        text: "Вариант не найден",
        show_alert: true,
      });
      return;
    }
    const by = { id: ctx.from.id, name: displayName(ctx.from) };
    card.rsvp = { status: "counter", byUserId: by.id, byName: by.name, slot };
    await updateCard(card);
    await ctx.editMessageText(renderCard(card), { parse_mode: "HTML" });
    await ctx.answerCallbackQuery({ text: `Вы предложили: ${slot}` });
    await notifyOwner(
      bot,
      card,
      `🕐 ${by.name} не может в «${card.time}» и предлагает: «${slot}». Подтвердить это время?`,
      counterConfirmKeyboard(card.id),
    );
  });

  // Отклонить приглашение
  bot.callbackQuery(/^d:(.+)$/, async (ctx) => {
    const card = await loadInviteCard(ctx, ctx.match[1]);
    if (!card || !(await ensurePending(ctx, card))) return;
    const by = { id: ctx.from.id, name: displayName(ctx.from) };
    card.rsvp = { status: "declined", byUserId: by.id, byName: by.name };
    await updateCard(card);
    await ctx.editMessageText(renderCard(card), { parse_mode: "HTML" });
    await ctx.answerCallbackQuery({ text: "Вы отклонили приглашение" });
    await notifyOwner(
      bot,
      card,
      `❌ ${by.name} отклонил(а) ваше приглашение.`,
    );
  });

  // Отправитель подтверждает предложенное время (в личке с ботом)
  bot.callbackQuery(/^c:(.+)$/, async (ctx) => {
    const card = await loadInviteCard(ctx, ctx.match[1]);
    if (!card) return;
    if (card.rsvp.status !== "counter") {
      await ctx.answerCallbackQuery({
        text: "Уже обработано",
        show_alert: true,
      });
      return;
    }
    card.time = card.rsvp.slot;
    card.rsvp = {
      status: "accepted",
      byUserId: card.rsvp.byUserId,
      byName: card.rsvp.byName,
    };
    await updateCard(card);
    await ctx.editMessageText(
      `✅ Время подтверждено: «${card.time}». Открытка обновлена в чате.`,
    );
    await ctx.answerCallbackQuery();
    await refreshInlineMessage(bot, card);
  });

  // Отправитель отклоняет предложенное время (в личке с ботом)
  bot.callbackQuery(/^x:(.+)$/, async (ctx) => {
    const card = await loadInviteCard(ctx, ctx.match[1]);
    if (!card) return;
    if (card.rsvp.status !== "counter") {
      await ctx.answerCallbackQuery({
        text: "Уже обработано",
        show_alert: true,
      });
      return;
    }
    card.rsvp = {
      status: "declined",
      byUserId: card.rsvp.byUserId,
      byName: card.rsvp.byName,
    };
    await updateCard(card);
    await ctx.editMessageText(
      "🚫 Вы отклонили предложенное время. Приглашение закрыто.",
    );
    await ctx.answerCallbackQuery();
    await refreshInlineMessage(bot, card);
  });
}
