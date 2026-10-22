/** Modelo de datos de Mentax. Todo vive en el dispositivo (IndexedDB). */

/** Fecha local en formato `YYYY-MM-DD`. */
export type DayKey = string

/** Qué busca cada pregunta diaria. La forma de preguntarlo rota; el objetivo, no. */
export type QuestionObjective = 'bien' | 'dificultad' | 'interior'

export interface DailyQuestion {
  objective: QuestionObjective
  text: string
  help: string
  hints: string[]
}

export interface DailyQuestionSet {
  date: DayKey
  questions: DailyQuestion[]
  source: 'ai' | 'local'
  createdAt: number
}

export interface Answer {
  question: string
  answer: string
  objective?: QuestionObjective
}

/** 1 = Mal … 5 = Muy bien. */
export type Mood = 1 | 2 | 3 | 4 | 5

export interface Analysis {
  title: string
  respuesta: string
  observacion: string
  aprendizaje: string
  sugerencia: string
  /** Solo cuando lo escrito apunta a algo serio; si no, null. */
  ayudaProfesional: string | null
  createdAt: number
}

export interface Reflection {
  id: string
  date: DayKey
  mode: 'full' | 'brief'
  answers: Answer[]
  mood?: Mood
  title: string
  favorite: boolean
  durationSec: number
  analysis?: Analysis
  createdAt: number
  updatedAt: number
}

export type GoalTone = 'violet' | 'mint' | 'pink' | 'peach'

export interface Goal {
  id: string
  title: string
  description: string
  progress: number
  status: 'active' | 'completed'
  tone: GoalTone
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

export interface Profile {
  name: string
  tagline: string
}
