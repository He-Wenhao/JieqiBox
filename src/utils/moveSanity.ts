// Sanity checks for moves coming back from the chess engine. The
// zero-weight Pikafish-jieqi we ship can't fully misbehave (Pikafish only
// emits legal moves per its own rules), but mismatches between our piece
// classification and the FEN we send can surface as moves that *look*
// illegal in the UI ("red eats red"). This catches them before display.
//
// All functions are pure so they're easy to unit-test.

import type { PieceLike } from './darkPieces'

/**
 * Reasons a move can be rejected. Specific enough to display to the user
 * and to filter on in tests.
 */
export type MoveRejectReason =
  | 'too-short'
  | 'malformed'
  | 'no-piece-at-from'
  | 'wrong-side-piece'
  | 'self-capture'
  | 'destination-equals-source'

export interface MoveSanityResult {
  ok: boolean
  reason?: MoveRejectReason
  detail?: string
}

/** Parse a UCI square like "e2" → { col: 4, row: 7 } in our 0..9 model
 *  coordinates (row 0 = top of FEN, row 9 = bottom). UCI uses rank 0 at
 *  bottom, so row = 9 - uciRank. */
export function parseUciSquare(
  s: string
): { col: number; row: number } | null {
  if (s.length < 2) return null
  const file = s.charCodeAt(0) - 'a'.charCodeAt(0)
  const rank = parseInt(s[1], 10)
  if (Number.isNaN(rank) || file < 0 || file > 8 || rank < 0 || rank > 9) {
    return null
  }
  return { col: file, row: 9 - rank }
}

/** Get a piece's "side" (`red` | `black`) from its name. Returns null for
 *  pieces whose name doesn't carry a side (shouldn't happen but defensive). */
export function pieceSide(piece: PieceLike): 'red' | 'black' | null {
  if (piece.name.startsWith('red_')) return 'red'
  if (piece.name.startsWith('black_')) return 'black'
  return null
}

/**
 * Check whether `move` is *board-state* sane against `pieces` for the side
 * to move. Does NOT validate piece movement rules (knight L-shape, cannon
 * jump, palace constraints, etc.) — that's a much bigger surface and
 * Pikafish handles it correctly. We only reject the kinds of nonsense we
 * actually see from the zero-weight engine + FEN classification mismatch:
 *   - move format must be ≥ 4 UCI chars (e.g. "h2e2" or "h2e2K")
 *   - the from-square has a piece
 *   - that piece belongs to the side that's supposed to move
 *   - the destination doesn't hold one of the moving side's own pieces
 *   - source ≠ destination
 */
export function checkMoveSanity(
  move: string,
  pieces: PieceLike[],
  sideToMove: 'red' | 'black'
): MoveSanityResult {
  if (typeof move !== 'string' || move.length < 4) {
    return { ok: false, reason: 'too-short', detail: `move=${JSON.stringify(move)}` }
  }
  const from = parseUciSquare(move.slice(0, 2))
  const to = parseUciSquare(move.slice(2, 4))
  if (!from || !to) {
    return { ok: false, reason: 'malformed', detail: move }
  }
  if (from.row === to.row && from.col === to.col) {
    return { ok: false, reason: 'destination-equals-source', detail: move }
  }
  const fromPiece = pieces.find(p => p.row === from.row && p.col === from.col)
  if (!fromPiece) {
    return {
      ok: false,
      reason: 'no-piece-at-from',
      detail: `${move} — no piece at ${move.slice(0, 2)}`,
    }
  }
  const fromSide = pieceSide(fromPiece)
  if (fromSide !== sideToMove) {
    return {
      ok: false,
      reason: 'wrong-side-piece',
      detail: `${move} — ${fromPiece.name} (${fromSide}) but ${sideToMove} to move`,
    }
  }
  const toPiece = pieces.find(p => p.row === to.row && p.col === to.col)
  if (toPiece) {
    const toSide = pieceSide(toPiece)
    if (toSide === sideToMove) {
      return {
        ok: false,
        reason: 'self-capture',
        detail: `${move} — would capture own ${toPiece.name}`,
      }
    }
  }
  return { ok: true }
}
