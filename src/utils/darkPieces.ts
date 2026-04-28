// Pure helpers for classifying "dark" (face-down) pieces in Jieqi based on
// the position of the kings. Extracted from PositionEditorDialog.vue so the
// logic is unit-testable.

export interface PieceLike {
  isKnown: boolean
  name: string
  row: number
  col: number
}

const TOP_REGION = [0, 1, 2, 3, 4]
const BOTTOM_REGION = [5, 6, 7, 8, 9]

/**
 * Determine which rows belong to red and which to black based on king positions.
 * Rules (in priority order):
 *   - If red king is found in a half (top or bottom), that half is red's; the
 *     other half is black's.
 *   - Else if red king is in the middle (rare/illegal but defensive) and black
 *     king is found, use black king to infer.
 *   - Else if only black king is found, infer from it.
 *   - Else default to "red on bottom, black on top".
 */
export function getDarkRowsByKings(pieces: PieceLike[]): {
  redRows: number[]
  blackRows: number[]
} {
  const redKing = pieces.find(p => p.isKnown && p.name === 'red_king')
  const blackKing = pieces.find(p => p.isKnown && p.name === 'black_king')

  const isInTop = (row: number) => TOP_REGION.includes(row)
  const isInBottom = (row: number) => BOTTOM_REGION.includes(row)

  let redRows = BOTTOM_REGION.slice()
  let blackRows = TOP_REGION.slice()

  if (redKing) {
    if (isInTop(redKing.row)) {
      redRows = TOP_REGION.slice()
      blackRows = BOTTOM_REGION.slice()
    } else if (isInBottom(redKing.row)) {
      redRows = BOTTOM_REGION.slice()
      blackRows = TOP_REGION.slice()
    } else if (blackKing) {
      if (isInTop(blackKing.row)) {
        blackRows = TOP_REGION.slice()
        redRows = BOTTOM_REGION.slice()
      } else if (isInBottom(blackKing.row)) {
        blackRows = BOTTOM_REGION.slice()
        redRows = TOP_REGION.slice()
      }
    }
  } else if (blackKing) {
    if (isInTop(blackKing.row)) {
      blackRows = TOP_REGION.slice()
      redRows = BOTTOM_REGION.slice()
    } else if (isInBottom(blackKing.row)) {
      blackRows = BOTTOM_REGION.slice()
      redRows = TOP_REGION.slice()
    }
  }

  return { redRows, blackRows }
}

export function classifyUnknownByKings(
  pieces: PieceLike[],
  row: number
): 'red_unknown' | 'black_unknown' {
  const { redRows } = getDarkRowsByKings(pieces)
  return redRows.includes(row) ? 'red_unknown' : 'black_unknown'
}

/**
 * Return a new pieces array with all dark pieces (`isKnown===false`) renamed
 * to `red_unknown` / `black_unknown` according to the king-based halves.
 */
export function reclassifyDarkPieces<T extends PieceLike>(pieces: T[]): T[] {
  const { redRows } = getDarkRowsByKings(pieces)
  return pieces.map(p => {
    if (p.isKnown) return p
    const newName = redRows.includes(p.row) ? 'red_unknown' : 'black_unknown'
    if (p.name === newName) return p
    return { ...p, name: newName }
  })
}
