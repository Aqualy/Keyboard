/** Announces a 3D key tap, so the typing test can treat it as typed input. */
export const KEY_TAP_EVENT = 'gmk:keytap'

/** Announces a soft keyboard character, so its 3D key can be pressed. */
export const SOFT_KEY_EVENT = 'gmk:softkey'

export const announceKeyTap = (code: string) =>
  window.dispatchEvent(new CustomEvent<string>(KEY_TAP_EVENT, { detail: code }))

export const announceSoftKey = (character: string) =>
  window.dispatchEvent(new CustomEvent<string>(SOFT_KEY_EVENT, { detail: character }))

/** Announces every key going down or up, from any input, for views that follow the keyboard. */
export const KEY_STATE_EVENT = 'gmk:keystate'

export interface KeyState {
  code: string
  down: boolean
}

export const announceKeyState = (code: string, down: boolean) =>
  window.dispatchEvent(new CustomEvent<KeyState>(KEY_STATE_EVENT, { detail: { code, down } }))
