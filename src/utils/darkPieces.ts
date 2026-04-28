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

const RED_TOP = { redRows: TOP_REGION.slice(), blackRows: BOTTOM_REGION.slice() }
const RED_BOTTOM = {
  redRows: BOTTOM_REGION.slice(),
  blackRows: TOP_REGION.slice(),
}

/**
 * Thrown by {@link getDarkRowsByKings} (and consumers) when a king is not
 * detected among the revealed pieces. Carries which side(s) are missing so
 * the UI can render an actionable message.
 */
export class MissingKingError extends Error {
  constructor(public readonly missing: 'red' | 'black' | 'both') {
    super(
      missing === 'both'
        ? 'Both kings missing — recognition is incomplete.'
        : `${missing === 'red' ? 'Red' : 'Black'} king not detected — recognition is incomplete.`
    )
    this.name = 'MissingKingError'
    // Restore prototype chain (TypeScript-down-target with extending Error)
    Object.setPrototypeOf(this, MissingKingError.prototype)
  }
}

/**
 * Determine which rows belong to red and which to black, *strictly* from king
 * positions. Throws {@link MissingKingError} if either king is absent. Callers
 * are expected to surface this error to the user rather than silently fall
 * back to a guessed orientation.
 */
export function getDarkRowsByKings(pieces: PieceLike[]): {
  redRows: number[]
  blackRows: number[]
} {
  const redKing = pieces.find(p => p.isKnown && p.name === 'red_king')
  const blackKing = pieces.find(p => p.isKnown && p.name === 'black_king')

  if (!redKing && !blackKing) throw new MissingKingError('both')
  if (!redKing) throw new MissingKingError('red')
  if (!blackKing) throw new MissingKingError('black')

  const isInTop = (row: number) => TOP_REGION.includes(row)
  const isInBottom = (row: number) => BOTTOM_REGION.includes(row)

  // Prefer red king's half.
  if (isInTop(redKing.row)) return RED_TOP
  if (isInBottom(redKing.row)) return RED_BOTTOM

  // Red king in middle row 5 (defensive — illegal in standard play). Use black.
  if (isInTop(blackKing.row)) return RED_BOTTOM
  if (isInBottom(blackKing.row)) return RED_TOP

  // Both kings on row 5 (impossible in legal play). Bail with a descriptive
  // error — better than silently picking a side.
  throw new MissingKingError('both')
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
