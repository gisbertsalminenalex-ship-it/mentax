/**
 * Contrato entre la app y la ruta /api/ai. Lo comparten cliente y servidor:
 * qué se envía en cada tarea y cómo se limpia lo que devuelve el modelo.
 */
import type { Analysis, DailyQuestion, DayKey, Mood, QuestionObjective, WeekSummary } from '../types'
import { OBJECTIVES } from '../questions'

export interface ContextReflection {
  date: DayKey
  mood?: Mood
  answers: { question: string; answer: string }[]
}

export interface MemoryContext {
  goals: { title: string; progress: number }[]
  learnings: string[]
}

export interface QuestionsInput extends MemoryContext {
  today: DayKey
  recent: ContextReflection[]
}

export interface AnalysisInput extends MemoryContext {
  reflection: ContextReflection
  recent: ContextReflection[]
}

export interface WeekInput extends MemoryContext {
  weekStart: DayKey
  reflections: ContextReflection[]
}

export type AIRequestBody =
  | { task: 'questions'; input: QuestionsInput }
  | { task: 'analysis'; input: AnalysisInput }
  | { task: 'week'; input: WeekInput }

export type AITask = AIRequestBody['task']

export type AIErrorCode = 'not-configured' | 'bad-request' | 'rate-limit' | 'failed'

export type AIResponse<T> = { ok: true; data: T } | { ok: false; error: AIErrorCode }

/** Tope del cuerpo de la petición: una semana de reflexiones largas cabe de sobra. */
export const MAX_BODY_BYTES = 60_000

// ── Validación de la petición ───────────────────────────

const isReflection = (v: unknown): v is ContextReflection =>
  isObject(v) &&
  typeof v.date === 'string' &&
  Array.isArray(v.answers) &&
  v.answers.every((a) => isObject(a) && typeof a.question === 'string' && typeof a.answer === 'string')

const isMemory = (v: Record<string, unknown>) =>
  Array.isArray(v.goals) &&
  v.goals.every((g) => isObject(g) && typeof g.title === 'string' && typeof g.progress === 'number') &&
  Array.isArray(v.learnings) &&
  v.learnings.every((l) => typeof l === 'string')

const isReflectionList = (v: unknown) => Array.isArray(v) && v.length <= 14 && v.every(isReflection)

/** Devuelve la petición si tiene la forma esperada; si no, null. */
export function parseAIRequest(raw: unknown): AIRequestBody | null {
  if (!isObject(raw) || !isObject(raw.input) || !isMemory(raw.input)) return null
  const input = raw.input
  switch (raw.task) {
    case 'questions':
      return typeof input.today === 'string' && isReflectionList(input.recent) ? (raw as AIRequestBody) : null
    case 'analysis':
      return isReflection(input.reflection) && isReflectionList(input.recent) ? (raw as AIRequestBody) : null
    case 'week':
      return typeof input.weekStart === 'string' && isReflectionList(input.reflections) && (input.reflections as unknown[]).length > 0 ? (raw as AIRequestBody) : null
    default:
      return null
  }
}

// ── Limpieza de la salida del modelo ────────────────────

const str = (v: unknown, max = 600): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

const strList = (v: unknown, maxItems: number, maxLen = 220): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems) : []

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Tres preguntas, una por objetivo y en orden; si falta alguna, null (se usarán las locales). */
export function cleanQuestions(raw: unknown): DailyQuestion[] | null {
  if (!isObject(raw) || !Array.isArray(raw.questions)) return null
  const byObjective = new Map<QuestionObjective, DailyQuestion>()
  for (const q of raw.questions) {
    if (!isObject(q)) continue
    const objective = q.objective as QuestionObjective
    const text = str(q.text, 200)
    if (!OBJECTIVES.includes(objective) || !text || byObjective.has(objective)) continue
    byObjective.set(objective, { objective, text, help: str(q.help, 240), hints: strList(q.hints, 3, 120) })
  }
  if (byObjective.size !== OBJECTIVES.length) return null
  return OBJECTIVES.map((o) => byObjective.get(o)!)
}

export function cleanAnalysis(raw: unknown, now: number = Date.now()): Analysis | null {
  if (!isObject(raw)) return null
  const respuesta = str(raw.respuesta, 1500)
  const observacion = str(raw.observacion)
  if (!respuesta && !observacion) return null
  const ayuda = str(raw.ayudaProfesional, 600)
  return {
    title: str(raw.title, 70).replace(/[.]+$/, ''),
    respuesta,
    observacion,
    aprendizaje: str(raw.aprendizaje),
    sugerencia: str(raw.sugerencia),
    ayudaProfesional: ayuda || null,
    createdAt: now,
  }
}

export function cleanWeek(raw: unknown): Pick<WeekSummary, 'resumen' | 'aprendizajes' | 'areas'> | null {
  if (!isObject(raw)) return null
  const resumen = str(raw.resumen, 900)
  const aprendizajes = strList(raw.aprendizajes, 4)
  const areas = strList(raw.areas, 3)
  if (!resumen && aprendizajes.length === 0) return null
  return { resumen, aprendizajes, areas }
}
