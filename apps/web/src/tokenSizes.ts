import type { BaseSize } from '@correlliayards/shared'

/** The printed size of each base token, in millimetres.
 *
 *  These are the physical dimensions of the real component, which is why they
 *  are exact rather than round: everything on the token is laid out in this
 *  space, and the stage scales the whole thing to whatever zoom is on screen.
 *  Get one wrong and the token prints at the wrong size, which is the one
 *  mistake a card game cannot absorb.
 *
 *  In the SPA rather than in @correlliayards/shared because millimetres are a
 *  print concern: the API stores which base size a ship uses and has no opinion
 *  about how big that is on paper.
 *
 *  Its own module rather than a constant beside the renderer that draws with it,
 *  because a file exporting both a component and its constants cannot be hot
 *  replaced — and because the editor's footer reads these to tell you what it is
 *  about to print, which is a second caller that has no business importing a
 *  renderer to find out. */
export const TOKEN_SIZE_MM: Record<BaseSize, { width: number; height: number }> = {
  Small: { width: 39, height: 71 },
  Medium: { width: 59, height: 102 },
  Large: { width: 73.5, height: 129 },
}
