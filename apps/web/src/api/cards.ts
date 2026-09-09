import { cardQueryToParams, type Card, type CardQuery, type CardSummary, type Page } from '@correlliayards/shared'
import type { LocalShipCard } from '../cardJson'
import { apiFetch } from './client'

/** One page of your own cards.
 *
 *  The filter object is serialised by the shared package's own function rather
 *  than by anything here, which is what stops the two sides disagreeing about
 *  conventions the string does not make obvious — `faction=none` meaning "cards
 *  with no faction restriction" rather than "do not filter on faction". */
export async function listCards(
  query: Partial<CardQuery>,
  signal?: AbortSignal,
): Promise<Page<CardSummary>> {
  const params = new URLSearchParams(cardQueryToParams(query)).toString()
  const res = await apiFetch(`/api/cards${params ? `?${params}` : ''}`, { signal })
  return (await res.json()) as Page<CardSummary>
}

export type SaveResult = {
  card: Card
  /** The row's new version. Held so the next save can present it as `If-Match`
   *  and be told 412 rather than silently overwriting an edit made elsewhere. */
  etag: string | null
  /** 201 rather than 200 — the first save of this card, not a replacement. */
  created: boolean
}

/** Write the card. Create and update are the same call: the editor minted the
 *  uuid, so the card is addressable before it has ever been saved and PUT is
 *  idempotent — a retried save over a flaky connection is harmless.
 *
 *  `etag` is null the first time, when there is no version to be stale against,
 *  and the tag from the previous save afterwards. */
export async function saveCard(card: LocalShipCard, etag: string | null): Promise<SaveResult> {
  const res = await apiFetch(`/api/cards/${card.id}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...(etag ? { 'if-match': etag } : {}),
    },
    body: JSON.stringify(card),
  })

  return {
    card: (await res.json()) as Card,
    etag: res.headers.get('etag'),
    created: res.status === 201,
  }
}
