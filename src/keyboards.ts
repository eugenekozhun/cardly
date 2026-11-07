import { InlineKeyboard } from "grammy";
import type { Card } from "./store.ts";

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🎁 Новая открытка", "menu:new")
    .row()
    .text("📋 Мои открытки", "menu:my");
}

export function templateKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("💌 Простая открытка", "tpl:simple")
    .row()
    .text("✉️ Приглашение", "tpl:invite");
}

export function slotsDoneKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("Готово ✅", "slots:done");
}

export function previewKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("💾 Сохранить", "pv:save")
    .text("🔄 Заново", "pv:restart");
}

export function sendKeyboard(): InlineKeyboard {
  return new InlineKeyboard().switchInline("📤 Отправить другу", "");
}

export function rsvpKeyboard(cardId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Принять", `a:${cardId}`)
    .row()
    .text("🕐 Другое время", `t:${cardId}`)
    .row()
    .text("❌ Отклонить", `d:${cardId}`);
}

export function slotsKeyboard(card: Card): InlineKeyboard {
  const kb = new InlineKeyboard();
  card.altSlots.forEach((slot, idx) => {
    kb.text(`🕐 ${slot}`, `s:${card.id}:${idx}`).row();
  });
  return kb.text("« Назад", `b:${card.id}`);
}

export function counterConfirmKeyboard(cardId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Подтвердить", `c:${cardId}`)
    .text("🚫 Отклонить", `x:${cardId}`);
}
