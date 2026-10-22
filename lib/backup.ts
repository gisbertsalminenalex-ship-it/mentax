/**
 * Copia de seguridad: exporta todos los datos a un JSON y lo restaura.
 * Las preguntas diarias no entran (se regeneran solas).
 */
import { db } from './db'
import type { Goal, Learning, Profile, Reflection, WeekSummary } from './types'

export const BACKUP_VERSION = 1

export interface Backup {
  app: 'mentax'
  version: number
  exportedAt: string
  data: {
    profile: Profile | null
    reflections: Reflection[]
    goals: Goal[]
    learnings: Learning[]
    weekSummaries: WeekSummary[]
  }
}

export async function buildBackup(now: Date = new Date()): Promise<Backup> {
  const [profile, reflections, goals, learnings, weekSummaries] = await Promise.all([
    db.settings.get('profile'),
    db.reflections.toArray(),
    db.goals.toArray(),
    db.learnings.toArray(),
    db.weekSummaries.toArray(),
  ])
  return {
    app: 'mentax',
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    data: { profile: (profile?.value as Profile | undefined) ?? null, reflections, goals, learnings, weekSummaries },
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Comprueba que el archivo es una copia de Mentax que esta versión sabe leer. */
export function parseBackup(text: string): Backup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es una copia de seguridad válida.')
  }
  if (!isObject(raw) || raw.app !== 'mentax' || !isObject(raw.data)) throw new Error('El archivo no es una copia de seguridad de Mentax.')
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) throw new Error('Esta copia es de una versión más nueva de Mentax.')
  const data = raw.data
  for (const key of ['reflections', 'goals', 'learnings', 'weekSummaries'] as const) {
    if (!Array.isArray(data[key]) || !(data[key] as unknown[]).every(isObject)) throw new Error('La copia de seguridad está incompleta o dañada.')
  }
  const reflections = data.reflections as Record<string, unknown>[]
  if (!reflections.every((r) => typeof r.id === 'string' && typeof r.date === 'string' && Array.isArray(r.answers))) {
    throw new Error('La copia de seguridad está incompleta o dañada.')
  }
  const goals = data.goals as Record<string, unknown>[]
  if (!goals.every((g) => typeof g.id === 'string' && typeof g.title === 'string')) throw new Error('La copia de seguridad está incompleta o dañada.')
  return raw as unknown as Backup
}

/** Sustituye todos los datos actuales por los de la copia. */
export async function restoreBackup(backup: Backup): Promise<void> {
  const { profile, reflections, goals, learnings, weekSummaries } = backup.data
  await db.transaction('rw', [db.reflections, db.goals, db.learnings, db.weekSummaries, db.settings, db.dailyQuestions], async () => {
    await Promise.all([db.reflections.clear(), db.goals.clear(), db.learnings.clear(), db.weekSummaries.clear(), db.settings.clear(), db.dailyQuestions.clear()])
    if (profile) await db.settings.put({ key: 'profile', value: profile })
    await db.reflections.bulkPut(reflections)
    await db.goals.bulkPut(goals)
    await db.learnings.bulkPut(learnings)
    await db.weekSummaries.bulkPut(weekSummaries)
  })
}

export function backupFileName(now: Date = new Date()): string {
  return `mentax-copia-${now.toISOString().slice(0, 10)}.json`
}
