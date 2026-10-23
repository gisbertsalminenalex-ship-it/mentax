/**
 * Lado cliente de la IA: reúne el contexto desde la base local, llama a
 * /api/ai y guarda el resultado. Sin IA, el diario sigue funcionando.
 */
import { addDays, parseDayKey, weekDays, weekStart } from '../dates'
import { applyEntryProgress, db, saveAnswersAndClosing, saveMentaxReflection } from '../db'
import { describeTracking, goalStatus, trackingOf } from '../goals'
import { localIdeasFor } from '../entries'
import type { DayKey, Entry, WeekSummary } from '../types'
import type { AIErrorCode, AIRequestBody, AIResponse, CloseResult, ContextEntry, GoalProgress, MemoryContext, ReflectResult } from './contract'

export class AIUnavailableError extends Error {
  constructor(readonly code: AIErrorCode) {
    super(AI_ERROR_MESSAGE[code])
  }
}

export const AI_ERROR_MESSAGE: Record<AIErrorCode, string> = {
  'not-configured': 'La IA de Mentax todavía no está activada en esta versión.',
  'rate-limit': 'Has hecho muchas peticiones seguidas. Espera unos minutos y vuelve a intentarlo.',
  'bad-request': 'No se ha podido preparar la petición a la IA.',
  failed: 'Mentax no ha podido responder ahora mismo. Inténtalo de nuevo en un momento.',
}

// Si el servidor no tiene IA configurada, no se vuelve a preguntar en esta sesión.
let notConfigured = false

async function callAI<T>(body: AIRequestBody, timeoutMs = 50_000): Promise<T> {
  if (notConfigured) throw new AIUnavailableError('not-configured')
  let res: Response
  try {
    res = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) })
  } catch {
    throw new AIUnavailableError('failed')
  }
  const json = (await res.json().catch(() => null)) as AIResponse<T> | null
  if (!json) throw new AIUnavailableError('failed')
  if (!json.ok) {
    if (json.error === 'not-configured') notConfigured = true
    throw new AIUnavailableError(json.error)
  }
  return json.data
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text)

export function qaOf(entry: Pick<Entry, 'reflection' | 'answers'>): { pregunta: string; respuesta: string }[] {
  return (entry.reflection?.preguntas ?? []).map((pregunta, i) => ({ pregunta, respuesta: entry.answers[i]?.trim() ?? '' }))
}

function toContext(e: Entry, maxText: number, maxAnswer = 300): ContextEntry {
  const qa = qaOf(e).filter((x) => x.respuesta).map((x) => ({ pregunta: x.pregunta, respuesta: clip(x.respuesta, maxAnswer) }))
  return { date: e.date, mood: e.mood, text: clip(e.text.trim(), maxText), ...(qa.length ? { qa } : {}), ...(e.closing?.aprendizaje ? { aprendizaje: e.closing.aprendizaje } : {}) }
}

/** Objetivos y aprendizajes para la IA, y a qué objetivo corresponde cada `ref` («g1»…). */
async function memoryWithRefs(today: DayKey): Promise<{ context: MemoryContext; refs: Map<string, string> }> {
  const thisWeek = parseDayKey(weekStart(today)).getTime()
  const [goals, learnings] = await Promise.all([db.goals.where('status').equals('active').toArray(), db.learnings.orderBy('createdAt').reverse().limit(10).toArray()])
  const active = goals.slice(0, 15)
  const refs = new Map(active.map((g, i) => [`g${i + 1}`, g.id]))
  return {
    refs,
    context: {
      goals: active.map((g, i) => ({ ref: `g${i + 1}`, title: g.title, progress: goalStatus(g, today).percent, thisWeek: g.createdAt >= thisWeek, seguimiento: describeTracking(trackingOf(g)) })),
      learnings: learnings.map((l) => l.text),
    },
  }
}

async function memory(today: DayKey): Promise<MemoryContext> {
  return (await memoryWithRefs(today)).context
}

/** Pasa los avances que ha visto la IA a los objetivos reales. Devuelve los objetivos completados. */
async function applyProgress(entry: Entry, avances: GoalProgress[], refs: Map<string, string>, replace: boolean): Promise<ProgressOutcome> {
  const items = avances.flatMap((a) => {
    const goalId = refs.get(a.ref)
    return goalId ? [{ goalId, note: a.nota }] : []
  })
  if (!items.length && !replace) return { advanced: 0, completed: [] }
  const completed = await applyEntryProgress(entry.id, entry.date, items, replace)
  return { advanced: items.length, completed }
}

export interface ProgressOutcome {
  /** Cuántos objetivos han avanzado con esta entrada. */
  advanced: number
  /** Títulos de los objetivos que se han completado solos. */
  completed: string[]
}

async function recentEntries(before: DayKey, count: number, maxText: number, excludeId?: string): Promise<ContextEntry[]> {
  const list = await db.reflections.where('date').belowOrEqual(before).reverse().sortBy('createdAt')
  return list
    .filter((e) => e.id !== excludeId && e.text.trim())
    .slice(0, count)
    .map((e) => toContext(e, maxText))
}

const weekdayOf = (date: DayKey) => parseDayKey(date).toLocaleDateString('es-ES', { weekday: 'long' })

// ── Reflexión de Mentax sobre la entrada ────────────────

export async function reflectOnEntry(id: string): Promise<ProgressOutcome> {
  const entry = await db.reflections.get(id)
  if (!entry || !entry.text.trim()) throw new AIUnavailableError('bad-request')
  const { context, refs } = await memoryWithRefs(entry.date)
  const { avances, ...reflection } = await callAI<ReflectResult>({
    task: 'reflect',
    input: { weekday: weekdayOf(entry.date), entry: toContext(entry, 6000), recent: await recentEntries(entry.date, 6, 500, id), ...context },
  })
  await saveMentaxReflection(id, reflection)
  // Reflexión nueva: los avances de una lectura anterior se sustituyen.
  return applyProgress(entry, avances, refs, true)
}

// ── Cierre tras las respuestas ──────────────────────────

export async function closeEntry(id: string, answers: string[]): Promise<ProgressOutcome> {
  const entry = await db.reflections.get(id)
  if (!entry?.reflection) throw new AIUnavailableError('bad-request')
  const qa = qaOf({ reflection: entry.reflection, answers }).map((x) => ({ pregunta: x.pregunta, respuesta: clip(x.respuesta, 2000) }))
  const { context, refs } = await memoryWithRefs(entry.date)
  const { avances, ...closing } = await callAI<CloseResult>({
    task: 'close',
    input: { entry: { date: entry.date, mood: entry.mood, text: clip(entry.text, 6000) }, reflexion: entry.reflection.reflexion, qa, ...context },
  })
  await saveAnswersAndClosing(id, answers, closing)
  // Las respuestas pueden añadir avances a los ya vistos en el texto.
  return applyProgress(entry, avances, refs, false)
}

// ── Ideas para escribir ─────────────────────────────────

export async function ideasForToday(today: DayKey): Promise<{ ideas: string[]; source: 'ai' | 'local' }> {
  const cached = await db.dailyIdeas.get(today)
  if (cached) return cached
  try {
    const ideas = await callAI<string[]>({ task: 'ideas', input: { today, recent: await recentEntries(addDays(today, -1), 5, 400), ...(await memory(today)) } }, 15_000)
    await db.dailyIdeas.put({ date: today, ideas, source: 'ai', createdAt: Date.now() })
    return { ideas, source: 'ai' }
  } catch {
    return { ideas: localIdeasFor(today), source: 'local' }
  }
}

// ── Resumen semanal ─────────────────────────────────────

export async function summarizeWeek(start: DayKey): Promise<WeekSummary> {
  const days = weekDays(start)
  const entries = (await db.reflections.where('date').between(days[0], days[6], true, true).sortBy('createdAt')).filter((e) => e.text.trim())
  if (entries.length === 0) throw new AIUnavailableError('bad-request')
  const result = await callAI<Pick<WeekSummary, 'resumen' | 'aprendizajes' | 'areas'>>({
    task: 'week',
    input: { weekStart: start, entries: entries.slice(-14).map((e) => toContext(e, 1200)), ...(await memory(start)) },
  })
  const summary: WeekSummary = { weekStart: start, ...result, reflectionCount: entries.length, createdAt: Date.now() }
  await db.weekSummaries.put(summary)
  return summary
}
