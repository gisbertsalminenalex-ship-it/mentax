/**
 * Lado cliente de la IA: reúne el contexto desde la base local, llama a
 * /api/ai y guarda el resultado. Si la IA no está disponible, la app sigue
 * funcionando con las preguntas locales.
 */
import { addDays, weekDays } from '../dates'
import { db, saveAnalysis } from '../db'
import { localQuestionsFor } from '../questions'
import type { Analysis, DailyQuestion, DayKey, Reflection, WeekSummary } from '../types'
import type { AIErrorCode, AIRequestBody, AIResponse, ContextReflection, MemoryContext } from './contract'

export class AIUnavailableError extends Error {
  constructor(readonly code: AIErrorCode) {
    super(AI_ERROR_MESSAGE[code])
  }
}

export const AI_ERROR_MESSAGE: Record<AIErrorCode, string> = {
  'not-configured': 'El análisis con IA todavía no está activado en esta versión de Mentax.',
  'rate-limit': 'Has hecho muchas peticiones seguidas. Espera unos minutos y vuelve a intentarlo.',
  'bad-request': 'No se ha podido preparar la petición a la IA.',
  failed: 'La IA no ha podido responder ahora mismo. Inténtalo de nuevo en un momento.',
}

// Si el servidor no tiene IA configurada, no se vuelve a preguntar en esta sesión.
let notConfigured = false

async function callAI<T>(body: AIRequestBody, timeoutMs = 45_000): Promise<T> {
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

function toContext(r: Reflection, maxAnswer: number): ContextReflection {
  return { date: r.date, mood: r.mood, answers: r.answers.map((a) => ({ question: a.question, answer: clip(a.answer.trim(), maxAnswer) })) }
}

async function memory(): Promise<MemoryContext> {
  const [goals, learnings] = await Promise.all([db.goals.where('status').equals('active').toArray(), db.learnings.orderBy('createdAt').reverse().limit(10).toArray()])
  return { goals: goals.slice(0, 8).map((g) => ({ title: g.title, progress: g.progress })), learnings: learnings.map((l) => l.text) }
}

async function recentReflections(before: DayKey, count: number, maxAnswer: number, excludeId?: string): Promise<ContextReflection[]> {
  const list = await db.reflections.where('date').belowOrEqual(before).reverse().sortBy('createdAt')
  return list
    .filter((r) => r.id !== excludeId)
    .slice(0, count)
    .map((r) => toContext(r, maxAnswer))
}

// ── Preguntas del día ───────────────────────────────────

export async function questionsForToday(today: DayKey): Promise<{ questions: DailyQuestion[]; source: 'ai' | 'local' }> {
  const cached = await db.dailyQuestions.get(today)
  if (cached) return cached
  try {
    const questions = await callAI<DailyQuestion[]>({ task: 'questions', input: { today, recent: await recentReflections(addDays(today, -1), 7, 400), ...(await memory()) } }, 15_000)
    await db.dailyQuestions.put({ date: today, questions, source: 'ai', createdAt: Date.now() })
    return { questions, source: 'ai' }
  } catch {
    return { questions: localQuestionsFor(today), source: 'local' }
  }
}

// ── Análisis de una reflexión ───────────────────────────

export async function analyzeReflection(id: string): Promise<Analysis> {
  const reflection = await db.reflections.get(id)
  if (!reflection) throw new AIUnavailableError('bad-request')
  const analysis = await callAI<Analysis>({
    task: 'analysis',
    input: { reflection: toContext(reflection, 1500), recent: await recentReflections(reflection.date, 6, 300, id), ...(await memory()) },
  })
  await saveAnalysis(id, analysis)
  return analysis
}

// ── Resumen semanal ─────────────────────────────────────

export async function summarizeWeek(weekStart: DayKey): Promise<WeekSummary> {
  const days = weekDays(weekStart)
  const reflections = await db.reflections.where('date').between(days[0], days[6], true, true).sortBy('createdAt')
  if (reflections.length === 0) throw new AIUnavailableError('bad-request')
  const result = await callAI<Pick<WeekSummary, 'resumen' | 'aprendizajes' | 'areas'>>({
    task: 'week',
    input: { weekStart, reflections: reflections.slice(-14).map((r) => toContext(r, 500)), ...(await memory()) },
  })
  const summary: WeekSummary = { weekStart, ...result, reflectionCount: reflections.length, createdAt: Date.now() }
  await db.weekSummaries.put(summary)
  return summary
}
