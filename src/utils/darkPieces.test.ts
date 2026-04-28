import { describe, it, expect } from 'vitest'
import {
  getDarkRowsByKings,
  classifyUnknownByKings,
  reclassifyDarkPieces,
  needsVerticalMirror,
  mirrorPiecesVertically,
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

  it('end-to-end orient invariant: after maybe-mirroring, red king is always in rows 5–9', () => {
    // Generate every reasonable red-king starting position (rows 0–9, col 4)
    // and check the post-orient row is in the red half. This is the actual
    // "Pikafish accepts this FEN" invariant we care about.
    for (let startRow = 0; startRow <= 9; startRow++) {
      const pieces: PieceLike[] = [
        { name: 'red_king', row: startRow, col: 4, isKnown: true },
        { name: 'black_king', row: 9 - startRow, col: 4, isKnown: true },
      ]
      const oriented = needsVerticalMirror(pieces)
        ? mirrorPiecesVertically(pieces)
        : pieces
      const redK = oriented.find(p => p.name === 'red_king')!
      expect(redK.row, `start row ${startRow}`).toBeGreaterThanOrEqual(5)
    }
  })

  it('mirrorPiecesVertically mirrors initialRow/initialCol if present', () => {
    const before = [
      {
        name: 'red_king',
        row: 0,
        col: 4,
        isKnown: true,
        initialRow: 0,
        initialCol: 4,
      } as any,
    ]
    const after = mirrorPiecesVertically(before)
    expect(after[0].row).toBe(9)
    expect(after[0].col).toBe(4)
    expect(after[0].initialRow).toBe(9)
    expect(after[0].initialCol).toBe(4)
  })

  it('needsVerticalMirror returns false when no red king (caller surfaces error)', () => {
    expect(needsVerticalMirror([])).toBe(false)
    expect(
      needsVerticalMirror([{ name: 'black_king', row: 0, col: 4, isKnown: true }])
    ).toBe(false)
  })

  it('needsVerticalMirror returns false when red king is on bottom (no flip needed)', () => {
    expect(
      needsVerticalMirror([
        { name: 'red_king', row: 9, col: 4, isKnown: true },
        { name: 'black_king', row: 0, col: 4, isKnown: true },
      ])
    ).toBe(false)
  })

  it('reclassifyDarkPieces propagates MissingKingError', () => {
    const pieces: PieceLike[] = [
      k('red_pawn', 6, 0, true), // no kings
      k('black_unknown', 1, 0, false),
    ]
    expect(() => reclassifyDarkPieces(pieces)).toThrow(MissingKingError)
  })

  it('user-reported scenario: red-on-top capture, after mirror engine sees valid red-on-bottom', () => {
    // Phone screenshot was taken from black's perspective: red is at the top
    // of the image, so YOLO records red pieces at rows 0–4 in the model.
    // Pikafish would reject this (red king must be at rows 7–9). The fix:
    // detect via needsVerticalMirror, then mirrorPiecesVertically.
    const recognized: PieceLike[] = [
      { name: 'red_king', row: 0, col: 4, isKnown: true },
      { name: 'black_king', row: 9, col: 4, isKnown: true },
      { name: 'red_chariot', row: 0, col: 0, isKnown: true },
      { name: 'black_pawn', row: 6, col: 0, isKnown: true },
      { name: 'red_unknown', row: 1, col: 2, isKnown: false }, // dark on red side
    ]
    expect(needsVerticalMirror(recognized)).toBe(true)
    const mirrored = mirrorPiecesVertically(recognized)
    const redK = mirrored.find(p => p.name === 'red_king')!
    const blackK = mirrored.find(p => p.name === 'black_king')!
    // Red king must be in the red palace rows (7–9) for Pikafish to accept it.
    expect(redK.row).toBeGreaterThanOrEqual(7)
    expect(redK.row).toBeLessThanOrEqual(9)
    // Black king must be in the black palace rows (0–2).
    expect(blackK.row).toBeGreaterThanOrEqual(0)
    expect(blackK.row).toBeLessThanOrEqual(2)
    // Specifically: row 0 ↔ row 9, col 4 stays mirror-symmetric.
    expect(redK.row).toBe(9)
    expect(blackK.row).toBe(0)
    expect(redK.col).toBe(4)
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
