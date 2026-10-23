/**
 * Utilidades de las entradas del diario: título, vista previa, ideas locales
 * para escribir y conversión de las reflexiones guiadas de la primera versión.
 */
import { parseDayKey } from './dates'
import { guessTracking } from './goals'
import type { DayKey, DetectedGoal, Entry, Mood } from './types'

/** En qué punto está la conversación con Mentax en una entrada. */
export type EntryStage = 'written' | 'questions' | 'closed'

export function stageOf(entry: Pick<Entry, 'reflection' | 'closing'>): EntryStage {
  if (entry.closing) return 'closed'
  if (entry.reflection) return 'questions'
  return 'written'
}

/** Título breve a partir del texto, cuando Mentax aún no ha puesto uno. */
export function deriveTitle(text: string): string {
  const first = text.trim()
  if (!first) return 'Entrada del diario'
  const sentence = first.split(/(?<=[.!?])\s|\n/)[0].replace(/[.!?:,;]+$/, '')
  const words = sentence.split(/\s+/)
  const title = words.length > 7 ? `${words.slice(0, 7).join(' ')}…` : sentence
  return title.charAt(0).toUpperCase() + title.slice(1)
}

export function previewOf(entry: Pick<Entry, 'text'>): string {
  return entry.text.trim().replace(/\s+/g, ' ')
}

const LOCAL_IDEAS = [
  '¿Qué momento de hoy te gustaría recordar?',
  '¿Qué te ha costado hoy y cómo lo has llevado?',
  '¿Qué has sentido hoy y qué crees que lo provocó?',
  '¿Qué decisión has tomado hoy y por qué?',
  '¿Con quién has hablado hoy y cómo te has sentido?',
  '¿Qué quieres conseguir esta semana?',
  '¿Por qué tres cosas te sientes agradecido hoy?',
  '¿Qué te ha dado energía hoy y qué te la ha quitado?',
  '¿Qué has aprendido hoy sobre ti?',
  '¿Qué harías distinto si repitieras el día?',
  '¿Cómo te has tratado hoy a ti mismo?',
  '¿Qué te preocupa ahora mismo y qué está en tu mano?',
]

/** Tres ideas locales para el día: cambian cada día de forma estable. */
export function localIdeasFor(date: DayKey): string[] {
  const n = Math.floor(parseDayKey(date).getTime() / 86_400_000)
  return [0, 4, 8].map((offset) => LOCAL_IDEAS[(n + offset) % LOCAL_IDEAS.length])
}

/** Reflexión guiada de la primera versión de Mentax (antes del diario libre). */
interface LegacyReflection {
  id: string
  date: DayKey
  mode?: 'full' | 'brief'
  answers: { question: string; answer: string }[]
  mood?: Mood
  title?: string
  favorite?: boolean
  durationSec?: number
  analysis?: { title?: string; respuesta?: string; observacion?: string; aprendizaje?: string; sugerencia?: string; ayudaProfesional?: string | null; createdAt?: number }
  createdAt?: number
  updatedAt?: number
}

/** Hasta la v3 los objetivos detectados eran solo texto. */
function toDetectedGoal(g: DetectedGoal | string): DetectedGoal {
  return typeof g === 'string' ? { title: g, tracking: guessTracking(g) } : g
}

/** Convierte una reflexión guiada antigua en entrada del diario; las nuevas pasan tal cual. */
export function migrateEntry(raw: Entry | LegacyReflection): Entry {
  if ('text' in raw && typeof raw.text === 'string') {
    const entry: Entry = { ...raw, answers: raw.answers ?? [], handledGoals: raw.handledGoals ?? [] }
    if (raw.reflection) entry.reflection = { ...raw.reflection, objetivos: (raw.reflection.objetivos ?? []).map(toDetectedGoal) }
    return entry
  }
  const old = raw as LegacyReflection
  const text = old.answers
    .filter((a) => a.answer?.trim())
    .map((a) => `${a.question}\n${a.answer.trim()}`)
    .join('\n\n')
  const now = Date.now()
  const a = old.analysis
  const comentario = [a?.observacion, a?.sugerencia].filter(Boolean).join(' ')
  return {
    id: old.id,
    date: old.date,
    text,
    mood: old.mood,
    title: old.title || deriveTitle(text),
    favorite: old.favorite ?? false,
    durationSec: old.durationSec ?? 0,
    reflection: a?.respuesta ? { title: a.title ?? '', reflexion: a.respuesta, preguntas: [], objetivos: [], ayudaProfesional: a.ayudaProfesional ?? null, createdAt: a.createdAt ?? now } : undefined,
    answers: [],
    closing: a && (comentario || a.aprendizaje) ? { comentario, aprendizaje: a.aprendizaje ?? '', ayudaProfesional: null, createdAt: a.createdAt ?? now } : undefined,
    handledGoals: [],
    createdAt: old.createdAt ?? now,
    updatedAt: old.updatedAt ?? now,
  }
}
