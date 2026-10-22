/**
 * Base de datos local (Dexie sobre IndexedDB). Nada sale del dispositivo
 * salvo lo que se envía a la IA al pedir un análisis.
 */
import Dexie, { type Table } from 'dexie'
import { deriveTitle } from './questions'
import type { Analysis, DailyQuestionSet, DayKey, Goal, GoalTone, Learning, Profile, Reflection, WeekSummary } from './types'

interface SettingEntry {
  key: string
  value: unknown
}

class MentaxDB extends Dexie {
  reflections!: Table<Reflection, string>
  goals!: Table<Goal, string>
  learnings!: Table<Learning, string>
  weekSummaries!: Table<WeekSummary, DayKey>
  dailyQuestions!: Table<DailyQuestionSet, DayKey>
  settings!: Table<SettingEntry, string>

  constructor() {
    super('mentax')
    this.version(1).stores({
      reflections: 'id, date, createdAt, favorite',
      goals: 'id, status, createdAt',
      learnings: 'id, createdAt, reflectionId',
      weekSummaries: 'weekStart',
      dailyQuestions: 'date',
      settings: 'key',
    })
  }
}

export const db = new MentaxDB()

export const newId = () => crypto.randomUUID()

// ── Perfil ──────────────────────────────────────────────

export const DEFAULT_PROFILE: Profile = { name: '', tagline: 'Construyendo una mejor versión de mí' }

export async function getProfile(): Promise<Profile> {
  const entry = await db.settings.get('profile')
  return { ...DEFAULT_PROFILE, ...(entry?.value as Partial<Profile> | undefined) }
}

export async function saveProfile(profile: Profile): Promise<void> {
  await db.settings.put({ key: 'profile', value: { name: profile.name.trim(), tagline: profile.tagline.trim() } })
}

// ── Reflexiones ─────────────────────────────────────────

export function listReflections(): Promise<Reflection[]> {
  return db.reflections.orderBy('createdAt').reverse().toArray()
}

export async function reflectionForDay(date: DayKey, mode: Reflection['mode'] = 'full'): Promise<Reflection | undefined> {
  const sameDay = await db.reflections.where('date').equals(date).toArray()
  return sameDay.find((r) => r.mode === mode)
}

export type ReflectionDraft = Pick<Reflection, 'date' | 'mode' | 'answers' | 'mood'> & { durationSec: number }

/** Crea la reflexión o, si se pasa `id`, la actualiza conservando favorito y tiempo acumulado. */
export async function saveReflection(draft: ReflectionDraft, id?: string): Promise<string> {
  const now = Date.now()
  const existing = id ? await db.reflections.get(id) : undefined
  const answersChanged = existing && JSON.stringify(existing.answers) !== JSON.stringify(draft.answers)
  const reflection: Reflection = {
    id: existing?.id ?? newId(),
    date: existing?.date ?? draft.date,
    mode: draft.mode,
    answers: draft.answers,
    mood: draft.mood,
    // Si el texto cambia, el análisis anterior ya no corresponde.
    title: existing?.analysis && !answersChanged ? existing.title : deriveTitle(draft.answers),
    favorite: existing?.favorite ?? false,
    durationSec: (existing?.durationSec ?? 0) + draft.durationSec,
    analysis: answersChanged ? undefined : existing?.analysis,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  await db.reflections.put(reflection)
  return reflection.id
}

export async function toggleFavorite(id: string): Promise<void> {
  const r = await db.reflections.get(id)
  if (r) await db.reflections.update(id, { favorite: !r.favorite })
}

export async function saveAnalysis(id: string, analysis: Analysis): Promise<void> {
  await db.reflections.update(id, analysis.title ? { analysis, title: analysis.title } : { analysis })
}

export async function deleteReflection(id: string): Promise<void> {
  await db.transaction('rw', db.reflections, db.learnings, async () => {
    await db.reflections.delete(id)
    await db.learnings.where('reflectionId').equals(id).delete()
  })
}

// ── Objetivos ───────────────────────────────────────────

const TONES: GoalTone[] = ['violet', 'mint', 'pink', 'peach']

export async function createGoal(title: string, description: string, progress: number): Promise<string> {
  const now = Date.now()
  const count = await db.goals.count()
  const id = newId()
  await db.goals.put({ id, title: title.trim(), description: description.trim(), progress: clampProgress(progress), status: 'active', tone: TONES[count % TONES.length], createdAt: now, updatedAt: now })
  return id
}

export async function updateGoal(id: string, changes: Partial<Pick<Goal, 'title' | 'description' | 'progress' | 'status'>>): Promise<void> {
  const patch: Partial<Goal> = { ...changes, updatedAt: Date.now() }
  if (changes.title !== undefined) patch.title = changes.title.trim()
  if (changes.description !== undefined) patch.description = changes.description.trim()
  if (changes.progress !== undefined) patch.progress = clampProgress(changes.progress)
  if (changes.status === 'completed') {
    patch.completedAt = Date.now()
    patch.progress = 100
  }
  if (changes.status === 'active') patch.completedAt = undefined
  await db.goals.update(id, patch)
}

export function deleteGoal(id: string): Promise<void> {
  return db.goals.delete(id)
}

function clampProgress(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

// ── Aprendizajes ────────────────────────────────────────

export async function saveLearning(text: string, reflectionId?: string): Promise<void> {
  const clean = text.trim()
  if (!clean) return
  const duplicate = await db.learnings.filter((l) => l.text === clean).first()
  if (duplicate) return
  await db.learnings.put({ id: newId(), text: clean, reflectionId, createdAt: Date.now() })
}

export function deleteLearning(id: string): Promise<void> {
  return db.learnings.delete(id)
}

// ── Todo ────────────────────────────────────────────────

export async function clearAll(): Promise<void> {
  await Promise.all(db.tables.map((t) => t.clear()))
}
