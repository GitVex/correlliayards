import { useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { loginHref } from '../auth/session'

/** Save, and the state of the save, in one control.
 *
 *  The colour is the state: filled while there is something to save, and the
 *  same plain plate as every other button once there is not. That is the whole
 *  signal — no separate "unsaved changes" indicator to keep in step with it.
 *
 *  Signed out, it becomes the way to sign in. A Save button that can only fail
 *  is worse than one that says what it actually needs, and the returnTo brings
 *  them back to the editor with their work still in place — nothing here is
 *  stored anywhere a login would clear. */
export function SaveButton({
  dirty,
  saving,
  justSaved,
  onSave,
}: {
  dirty: boolean
  saving: boolean
  /** Briefly true after a save lands, so the button can confirm it happened.
   *  The same pattern Copy JSON already uses next to it. */
  justSaved: boolean
  onSave: () => void
}) {
  const { session } = useAuth()
  const location = useLocation()

  if (session?.status === 'anonymous') {
    return (
      <a className="btn btn--accent" href={loginHref(location.pathname + location.search)}>
        Sign in to save
      </a>
    )
  }

  return (
    <button
      className={dirty ? 'btn btn--accent' : 'btn'}
      onClick={onSave}
      disabled={saving}
      title={dirty ? 'Save this card to your account' : 'No changes since the last save'}
    >
      {saving ? 'Saving…' : justSaved ? 'Saved' : 'Save'}
    </button>
  )
}
