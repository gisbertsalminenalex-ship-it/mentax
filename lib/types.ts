/** Modelo de datos de Mentax. Todo vive en el dispositivo (IndexedDB). */

/** Fecha local en formato `YYYY-MM-DD`. */
export type DayKey = string

/** 1 = Mal … 5 = Muy bien. */
export type Mood = 1 | 2 | 3 | 4 | 5

/** Lo primero que dice Mentax al leer la entrada del diario. */
export interface MentaxReflection {
  title: string
  reflexion: string
  /** Preguntas para seguir reflexionando (normalmente dos). */
  preguntas: string[]
  /** Objetivos que el usuario ha mencionado en el texto, para proponer añadirlos. */
  objetivos: DetectedGoal[]
  /** Solo cuando lo escrito apunta a algo serio; si no, null. */
  ayudaProfesional: string | null
  createdAt: number
}

/** El comentario con el que Mentax cierra el día, tras leer las respuestas. */
export interface MentaxClosing {
  comentario: string
  aprendizaje: string
  ayudaProfesional: string | null
  createdAt: number
}

/** Una entrada del diario: lo que escribe el usuario y la conversación con Mentax. */
export interface Entry {
  id: string
  date: DayKey
  text: string
  mood?: Mood
  title: string
  favorite: boolean
  durationSec: number
  reflection?: MentaxReflection
  /** Respuestas a `reflection.preguntas`, en el mismo orden. */
  answers: string[]
  closing?: MentaxClosing
  /** Objetivos detectados que el usuario ya ha añadido o descartado. */
  handledGoals: string[]
  createdAt: number
  updatedAt: number
}

export type GoalTone = 'violet' | 'mint' | 'pink' | 'peach'

/** Cómo se mide un objetivo. «manual»: la barra la mueve el usuario. */
export type GoalTracking =
  | { kind: 'manual' }
  | { kind: 'daily' }
  | { kind: 'weekly'; times: number }
  | { kind: 'total'; times: number }

export interface DetectedGoal {
  title: string
  tracking: GoalTracking
}

/** Un día en que el usuario avanzó en el objetivo (lo detecta Mentax o lo marca él). */
export interface GoalCheckin {
  date: DayKey
  /** Entrada del diario donde se detectó; vacío si lo marcó el usuario. */
  entryId?: string
  note: string
  createdAt: number
}

export interface Goal {
  id: string
  title: string
  description: string
  /** Progreso manual (solo cuenta si `tracking` es manual). */
  progress: number
  status: 'active' | 'completed'
  tone: GoalTone
  tracking?: GoalTracking
  checkins?: GoalCheckin[]
  /** Entrada del diario de la que salió, si la detectó Mentax. */
  entryId?: string
  createdAt: number
  updatedAt: number
  completedAt?: number
}

/** Un aprendizaje que el usuario decidió guardar. Es la memoria de Mentax. */
export interface Learning {
  id: string
  text: string
  reflectionId?: string
  createdAt: number
}

export interface WeekSummary {
  weekStart: DayKey
  resumen: string
  aprendizajes: string[]
  areas: string[]
  reflectionCount: number
  createdAt: number
}

/** Ideas para escribir del día (las sugiere la IA o el banco local). */
export interface DailyIdeas {
  date: DayKey
  ideas: string[]
  source: 'ai' | 'local'
  createdAt: number
}

export interface Profile {
  name: string
  tagline: string
}
