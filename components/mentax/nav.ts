export type Screen = 'home' | 'write' | 'diary' | 'entry' | 'week' | 'goals' | 'goal' | 'profile'

export interface Route {
  screen: Screen
  /** Entrada u objetivo al que se refiere la pantalla. */
  id?: string
}

/** `replace` sustituye la pantalla actual en el historial (p. ej. el editor tras guardar). */
export type Navigate = (screen: Screen, id?: string, options?: { replace?: boolean }) => void

export type Notify = (message: string) => void
