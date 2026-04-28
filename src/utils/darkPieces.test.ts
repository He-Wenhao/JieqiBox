import { describe, it, expect } from 'vitest'
import {
  getDarkRowsByKings,
  classifyUnknownByKings,
  reclassifyDarkPieces,
  MissingKingError,
  type PieceLike,
} from './darkPieces'

const k = (
  name: string,
  row: number,
  col = 4,
  isKnown = true
): PieceLike => ({
  name,
  row,
  col,
  isKnown,
})

describe('getDarkRowsByKings', () => {
  it('throws MissingKingError when no kings present', () => {
    expect(() => getDarkRowsByKings([])).toThrow(MissingKingError)
    try {
      getDarkRowsByKings([])
    } catch (e: any) {
      expect(e.missing).toBe('both')
    }
  })

  it('throws MissingKingError when red king is missing', () => {
    expect(() => getDarkRowsByKings([k('black_king', 0)])).toThrow(
      MissingKingError
    )
    try {
      getDarkRowsByKings([k('black_king', 0)])
    } catch (e: any) {
      expect(e.missing).toBe('red')
    }
  })

  it('throws MissingKingError when black king is missing', () => {
    expect(() => getDarkRowsByKings([k('red_king', 9)])).toThrow(
      MissingKingError
    )
    try {
      getDarkRowsByKings([k('red_king', 9)])
    } catch (e: any) {
      expect(e.missing).toBe('black')
    }
  })

  it('red king at row 9 (bottom, standard) → red rows = bottom', () => {
    const { redRows, blackRows } = getDarkRowsByKings([
      k('red_king', 9),
      k('black_king', 0),
    ])
    expect(redRows).toEqual([5, 6, 7, 8, 9])
    expect(blackRows).toEqual([0, 1, 2, 3, 4])
  })

  it('red king at row 0 (top, flipped position) → red rows = top', () => {
    const { redRows, blackRows } = getDarkRowsByKings([
      k('red_king', 0),
      k('black_king', 9),
    ])
    expect(redRows).toEqual([0, 1, 2, 3, 4])
    expect(blackRows).toEqual([5, 6, 7, 8, 9])
  })
})

describe('classifyUnknownByKings', () => {
  it('red king on top → row 2 is red_unknown', () => {
    const pieces = [k('red_king', 1), k('black_king', 8)]
    expect(classifyUnknownByKings(pieces, 2)).toBe('red_unknown')
    expect(classifyUnknownByKings(pieces, 7)).toBe('black_unknown')
  })

  it('red king on bottom → row 7 is red_unknown', () => {
    const pieces = [k('red_king', 9), k('black_king', 0)]
    expect(classifyUnknownByKings(pieces, 7)).toBe('red_unknown')
    expect(classifyUnknownByKings(pieces, 2)).toBe('black_unknown')
  })

  it('no kings → throws MissingKingError', () => {
    expect(() => classifyUnknownByKings([], 7)).toThrow(MissingKingError)
  })
})

describe('reclassifyDarkPieces', () => {
  it('renames mis-classified dark pieces according to kings', () => {
    // Red king on TOP (row 1). Means red side = top half.
    // A dark piece at row 2 (top half) was incorrectly named 'black_unknown'.
    // After reclassify it should become 'red_unknown'.
    const before: PieceLike[] = [
      k('red_king', 1),
      k('black_king', 8),
      k('black_unknown', 2, 0, false), // mis-classified
      k('red_unknown', 7, 0, false), // mis-classified
    ]
    const after = reclassifyDarkPieces(before)
    const dp1 = after.find(p => p.row === 2 && !p.isKnown)
    const dp2 = after.find(p => p.row === 7 && !p.isKnown)
    expect(dp1?.name).toBe('red_unknown')
    expect(dp2?.name).toBe('black_unknown')
  })

  it('leaves known pieces untouched', () => {
    const before: PieceLike[] = [
      k('red_king', 9),
      k('black_king', 0),
      k('red_pawn', 6, 0, true),
    ]
    const after = reclassifyDarkPieces(before)
    expect(after.find(p => p.name === 'red_pawn')).toBeDefined()
  })

  it('reclassifyDarkPieces propagates MissingKingError', () => {
    const pieces: PieceLike[] = [
      k('red_pawn', 6, 0, true), // no kings
      k('black_unknown', 1, 0, false),
    ]
    expect(() => reclassifyDarkPieces(pieces)).toThrow(MissingKingError)
  })

  it('handles a fully red-on-top board (the user-reported scenario)', () => {
    // Red king at top, several dark pieces around it.
    // All dark pieces in top half should classify as red_unknown.
    const pieces: PieceLike[] = [
      k('red_king', 0, 4, true),
      k('black_king', 9, 4, true),
      k('dark', 0, 0, false),
      k('dark', 1, 1, false),
      k('dark', 2, 4, false),
      k('dark', 7, 4, false),
      k('dark', 8, 1, false),
      k('dark', 9, 0, false),
    ]
    const after = reclassifyDarkPieces(pieces)
    const topHalf = after.filter(p => !p.isKnown && p.row <= 4)
    const bottomHalf = after.filter(p => !p.isKnown && p.row >= 5)
    expect(topHalf.every(p => p.name === 'red_unknown')).toBe(true)
    expect(bottomHalf.every(p => p.name === 'black_unknown')).toBe(true)
  })
})
