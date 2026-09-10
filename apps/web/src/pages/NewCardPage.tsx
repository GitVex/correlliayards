import { useState } from 'react'
import { blankSeed } from '../cardHydration'
import { EditorPage } from './EditorPage'

/** The editor with nothing in it, at `/`.
 *
 *  Not behind the session gate, and that is deliberate: you can lay out a card,
 *  export it and copy its JSON without an account. Signing in is what lets you
 *  keep one. */
export function NewCardPage() {
  /* Once per mount, never per render. `blankSeed` mints a uuid, and a card that
     changed identity between a keystroke and the save that followed it would
     save twice under two ids. */
  const [seed] = useState(blankSeed)
  return <EditorPage seed={seed} />
}
