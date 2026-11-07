export type CardKind = "simple" | "invite";
export type RsvpStatus = "pending" | "accepted" | "counter" | "declined";

export interface Rsvp {
  status: RsvpStatus;
  byUserId?: number;
  byName?: string;
  slot?: string;
}

export interface Card {
  id: string;
  ownerId: number;
  ownerName: string;
  kind: CardKind;
  text: string;
  time?: string;
  altSlots: string[];
  rsvp: Rsvp;
  inlineMessageId?: string;
}

const kv = await Deno.openKv();

const ID_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateCardId(length = 7): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
}

export async function saveCard(card: Card): Promise<void> {
  await kv.atomic()
    .set(["cards", card.id], card)
    .set(["cardsByOwner", card.ownerId, card.id], card.id)
    .commit();
}

export async function getCard(id: string): Promise<Card | null> {
  const entry = await kv.get<Card>(["cards", id]);
  return entry.value;
}

export async function updateCard(card: Card): Promise<void> {
  await kv.set(["cards", card.id], card);
}

export async function listCardsByOwner(ownerId: number): Promise<Card[]> {
  const cards: Card[] = [];
  const iter = kv.list<string>({ prefix: ["cardsByOwner", ownerId] });
  for await (const entry of iter) {
    const card = await getCard(entry.value);
    if (card) cards.push(card);
  }
  return cards;
}

export async function deleteCard(id: string, ownerId: number): Promise<void> {
  await kv.atomic()
    .delete(["cards", id])
    .delete(["cardsByOwner", ownerId, id])
    .commit();
}
