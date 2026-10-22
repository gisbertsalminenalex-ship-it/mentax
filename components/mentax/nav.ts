export type Screen = 'home' | 'reflection' | 'reflections' | 'detail' | 'week' | 'goals' | 'goal' | 'analysis' | 'brief' | 'profile'

export interface Route {
  screen: Screen
  /** Reflexión u objetivo al que se refiere la pantalla. */
  id?: string
}

export type Navigate = (screen: Screen, id?: string) => void

export type Notify = (message: string) => void
