/**
 * Contrato entre la app y la ruta /api/ai. Lo comparten cliente y servidor:
 * qué se envía en cada tarea y cómo se limpia lo que devuelve el modelo.
 */
import type { DayKey, MentaxClosing, MentaxReflection, Mood, WeekSummary } from '../types'

/** Una entrada del diario tal como la ve la IA (recortada). */
export interface ContextEntry {
  date: DayKey
  mood?: Mood
  text: string
  /** Lo que Mentax preguntó y lo que respondió el usuario. */
  qa?: { pregunta: string; respuesta: string }[]
  aprendizaje?: string
}

export interface MemoryContext {
  goals: { title: string; progress: number; thisWeek: boolean }[]
  learnings: string[]
}

export interface ReflectInput extends MemoryContext {
  /** Día de la semana de la entrada («domingo»…). */
  weekday: string
  entry: ContextEntry
  recent: ContextEntry[]
}

export interface CloseInput extends MemoryContext {
  entry: ContextEntry
  reflexion: string
  qa: { pregunta: string; respuesta: string }[]
}

export interface IdeasInput extends MemoryContext {
  today: DayKey
  recent: ContextEntry[]
}

export interface WeekInput extends MemoryContext {
  weekStart: DayKey
  entries: ContextEntry[]
}

export type AIRequestBody =
  | { task: 'reflect'; input: ReflectInput }
  | { task: 'close'; input: CloseInput }
  | { task: 'ideas'; input: IdeasInput }
  | { task: 'week'; input: WeekInput }

export type AITask = AIRequestBody['task']

export type AIErrorCode = 'not-configured' | 'bad-request' | 'rate-limit' | 'failed'

export type AIResponse<T> = { ok: true; data: T } | { ok: false; error: AIErrorCode }

/** Tope del cuerpo de la petición: una semana de entradas largas cabe de sobra. */
export const MAX_BODY_BYTES = 80_000

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

// ── Validación de la petición ───────────────────────────

const isQA = (v: unknown) => Array.isArray(v) && v.every((x) => isObject(x) && typeof x.pregunta === 'string' && typeof x.respuesta === 'string')

const isEntry = (v: unknown): v is ContextEntry =>
  isObject(v) && typeof v.date === 'string' && typeof v.text === 'string' && (v.qa === undefined || isQA(v.qa))

const isMemory = (v: Record<string, unknown>) =>
  Array.isArray(v.goals) &&
  v.goals.every((g) => isObject(g) && typeof g.title === 'string' && typeof g.progress === 'number') &&
  Array.isArray(v.learnings) &&
  v.learnings.every((l) => typeof l === 'string')

const isEntryList = (v: unknown) => Array.isArray(v) && v.length <= 14 && v.every(isEntry)

/** Devuelve la petición si tiene la forma esperada; si no, null. */
export function parseAIRequest(raw: unknown): AIRequestBody | null {
  if (!isObject(raw) || !isObject(raw.input) || !isMemory(raw.input)) return null
  const input = raw.input
  switch (raw.task) {
    case 'reflect':
      return typeof input.weekday === 'string' && isEntry(input.entry) && (input.entry as ContextEntry).text.trim() !== '' && isEntryList(input.recent) ? (raw as AIRequestBody) : null
    case 'close':
      return isEntry(input.entry) && typeof input.reflexion === 'string' && isQA(input.qa) && (input.qa as unknown[]).length > 0 ? (raw as AIRequestBody) : null
    case 'ideas':
      return typeof input.today === 'string' && isEntryList(input.recent) ? (raw as AIRequestBody) : null
    case 'week':
      return typeof input.weekStart === 'string' && isEntryList(input.entries) && (input.entries as unknown[]).length > 0 ? (raw as AIRequestBody) : null
    default:
      return null
  }
}

// ── Limpieza de la salida del modelo ────────────────────

const str = (v: unknown, max = 600): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

const strList = (v: unknown, maxItems: number, maxLen = 220): string[] =>
  Array.isArray(v) ? [...new Set(v.map((x) => str(x, maxLen)).filter(Boolean))].slice(0, maxItems) : []

export function cleanReflection(raw: unknown, now: number = Date.now()): MentaxReflection | null {
  if (!isObject(raw)) return null
  const reflexion = str(raw.reflexion, 2000)
  const preguntas = strList(raw.preguntas, 3, 240)
  if (!reflexion || preguntas.length === 0) return null
  return {
    title: str(raw.title, 70).replace(/[.]+$/, ''),
    reflexion,
    preguntas,
    objetivos: strList(raw.objetivos, 5, 90),
    ayudaProfesional: str(raw.ayudaProfesional, 600) || null,
    createdAt: now,
  }
}

export function cleanClosing(raw: unknown, now: number = Date.now()): MentaxClosing | null {
  if (!isObject(raw)) return null
  const comentario = str(raw.comentario, 1500)
  if (!comentario) return null
  return { comentario, aprendizaje: str(raw.aprendizaje, 300), ayudaProfesional: str(raw.ayudaProfesional, 600) || null, createdAt: now }
}

export function cleanIdeas(raw: unknown): string[] | null {
  if (!isObject(raw)) return null
  const ideas = strList(raw.ideas, 3, 160)
  return ideas.length ? ideas : null
}

export function cleanWeek(raw: unknown): Pick<WeekSummary, 'resumen' | 'aprendizajes' | 'areas'> | null {
  if (!isObject(raw)) return null
  const resumen = str(raw.resumen, 900)
  const aprendizajes = strList(raw.aprendizajes, 4)
  const areas = strList(raw.areas, 3)
  if (!resumen && aprendizajes.length === 0) return null
  return { resumen, aprendizajes, areas }
}
