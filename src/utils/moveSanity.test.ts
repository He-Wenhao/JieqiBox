import { describe, it, expect } from 'vitest'
import {
  parseUciSquare,
  pieceSide,
  checkMoveSanity,
} from './moveSanity'
import type { PieceLike } from './darkPieces'

const k = (
  name: string,
  row: number,
  col: number,
  isKnown = true
): PieceLike => ({
  name,
  row,
  col,
  isKnown,
})

describe('parseUciSquare', () => {
  it('a0 → bottom-left in model coords (row 9, col 0)', () => {
    expect(parseUciSquare('a0')).toEqual({ col: 0, row: 9 })
  })
  it('i9 → top-right (row 0, col 8)', () => {
    expect(parseUciSquare('i9')).toEqual({ col: 8, row: 0 })
  })
  it('rejects malformed input', () => {
    expect(parseUciSquare('zz')).toBeNull()
    expect(parseUciSquare('a')).toBeNull()
    expect(parseUciSquare('aa')).toBeNull()
  })
})

describe('pieceSide', () => {
  it('returns red/black/null based on name prefix', () => {
    expect(pieceSide(k('red_king', 9, 4))).toBe('red')
    expect(pieceSide(k('black_pawn', 0, 0))).toBe('black')
    expect(pieceSide(k('red_unknown', 7, 0, false))).toBe('red')
    expect(pieceSide(k('black_unknown', 2, 0, false))).toBe('black')
    expect(pieceSide(k('weird', 0, 0))).toBeNull()
  })
})

describe('checkMoveSanity', () => {
  // Standard starting-ish position fragment
  const std = (): PieceLike[] => [
    k('red_king', 9, 4),
    k('red_pawn', 6, 4),
    k('black_king', 0, 4),
    k('black_pawn', 3, 4),
    k('red_unknown', 7, 0, false), // dark red on red side
    k('black_unknown', 2, 0, false), // dark black on black side
  ]

  it('valid red move e3e4 (from row 6 → 5)', () => {
    // UCI: e3 = file e (col 4), rank 3 = row 9-3 = 6. e4 = row 9-4 = 5.
    const r = checkMoveSanity('e3e4', std(), 'red')
    expect(r.ok).toBe(true)
  })

  it('rejects a move from an empty square', () => {
    const r = checkMoveSanity('a5a6', std(), 'red')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('no-piece-at-from')
  })

  it('rejects a move using opponent piece (red turn, black piece)', () => {
    // e6 = col 4, row 9-6 = 3. That's the black pawn.
    const r = checkMoveSanity('e6e5', std(), 'red')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('wrong-side-piece')
  })

  it('rejects self-capture: red captures its own piece', () => {
    // Place two reds and try to capture one with the other.
    const pieces = [
      k('red_king', 9, 4),
      k('red_chariot', 9, 0),
      k('red_pawn', 9, 1),
      k('black_king', 0, 4),
    ]
    // a0 = col 0, row 9. b0 = col 1, row 9. Chariot captures own pawn.
    const r = checkMoveSanity('a0b0', pieces, 'red')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('self-capture')
  })

  it('the user-reported "red dark eats red piece" scenario', () => {
    // Dark red piece at h0 attempts to capture a red piece at e0.
    // From the user's complaint — exactly what they saw the engine suggest.
    const pieces = [
      k('red_king', 9, 4),
      k('red_chariot', 9, 4),
      k('red_unknown', 9, 7, false),
      k('black_king', 0, 4),
    ]
    // h0 = col 7, row 9. e0 = col 4, row 9.
    const r = checkMoveSanity('h0e0', pieces, 'red')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('self-capture')
    expect(r.detail).toMatch(/own/)
  })

  it('legal capture: red captures black', () => {
    const pieces = [
      k('red_king', 9, 4),
      k('red_chariot', 5, 0),
      k('black_chariot', 5, 8), // black chariot at i4
      k('black_king', 0, 4),
    ]
    // a4 = col 0, row 5. i4 = col 8, row 5. Capture across rank 4.
    const r = checkMoveSanity('a4i4', pieces, 'red')
    expect(r.ok).toBe(true)
  })

  it('rejects malformed / too-short moves', () => {
    expect(checkMoveSanity('', std(), 'red').reason).toBe('too-short')
    expect(checkMoveSanity('e3', std(), 'red').reason).toBe('too-short')
    expect(checkMoveSanity('zz99', std(), 'red').reason).toBe('malformed')
  })

  it('rejects destination == source', () => {
    const r = checkMoveSanity('e3e3', std(), 'red')
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('destination-equals-source')
  })

  it('handles UCI moves with flip suffix (e.g. h0e2K)', () => {
    const r = checkMoveSanity('e3e4K', std(), 'red')
    // The 5th char (the flip) is part of jieqi-extended UCI; we ignore it
    // for sanity and just look at the first 4 chars.
    expect(r.ok).toBe(true)
  })
})
