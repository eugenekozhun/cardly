import type { Card } from "./store.ts";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderCard(card: Card): string {
  return card.kind === "simple" ? renderSimple(card) : renderInvite(card);
}

function renderSimple(card: Card): string {
  return [
    "💌 <b>Открытка для тебя!</b>",
    "",
    escapeHtml(card.text),
    "",
    `— <i>${escapeHtml(card.ownerName)}</i>`,
  ].join("\n");
}

function renderInvite(card: Card): string {
  const lines = [
    "✉️ <b>Приглашение</b>",
    "",
    escapeHtml(card.text),
    "",
    `🗓 <b>Когда:</b> ${escapeHtml(card.time ?? "—")}`,
    "",
  ];
  switch (card.rsvp.status) {
    case "pending":
      lines.push("<i>Ожидает ответа…</i>");
      break;
    case "accepted": {
      const moved = card.rsvp.slot && card.rsvp.slot !== card.time
        ? ` (время: ${escapeHtml(card.rsvp.slot)})`
        : "";
      lines.push(
        `✅ <b>Принято</b> — ${escapeHtml(card.rsvp.byName ?? "")}${moved}`,
      );
      break;
    }
    case "counter":
      lines.push(
        `🕐 ${escapeHtml(card.rsvp.byName ?? "")} предлагает другое время: <b>${
          escapeHtml(card.rsvp.slot ?? "")
        }</b>`,
      );
      break;
    case "declined":
      lines.push(
        `❌ <b>Отклонено</b> — ${escapeHtml(card.rsvp.byName ?? "")}`,
      );
      break;
  }
  return lines.join("\n");
}

export function statusLabel(card: Card): string {
  if (card.kind === "simple") return "💌";
  switch (card.rsvp.status) {
    case "pending":
      return "⏳";
    case "accepted":
      return "✅";
    case "counter":
      return "🕐";
    case "declined":
      return "❌";
  }
}
