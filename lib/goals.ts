/**
 * Seguimiento de objetivos: cómo se mide cada uno y cuánto lleva, a partir de
 * los avances que Mentax detecta en el diario (o que marca el usuario).
 */
import { addDays, weekStart } from './dates'
import type { DayKey, Goal, GoalCheckin, GoalTracking } from './types'

export const MANUAL: GoalTracking = { kind: 'manual' }

export function trackingOf(goal: Pick<Goal, 'tracking'>): GoalTracking {
  return goal.tracking ?? MANUAL
}

const clampTimes = (n: number) => Math.max(1, Math.min(100, Math.round(n) || 1))

export function normalizeTracking(t: GoalTracking): GoalTracking {
  if (t.kind === 'weekly') return { kind: 'weekly', times: Math.min(7, clampTimes(t.times)) }
  if (t.kind === 'total') return { kind: 'total', times: clampTimes(t.times) }
  return t
}

const NUMBER_WORDS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 }

/** Deduce cómo medir un objetivo a partir de cómo está escrito. */
export function guessTracking(title: string): GoalTracking {
  const t = title.toLowerCase()
  if (/\b(cada d[ií]a|todos los d[ií]as|a diario|diariamente)\b/.test(t)) return { kind: 'daily' }
  const n = t.match(/\b(\d{1,3}|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(d[ií]as|veces)\b/)
  if (n) {
    const times = Number(n[1]) || NUMBER_WORDS[n[1]] || 1
    if (/\b(en total|este mes|al mes)\b/.test(t)) return { kind: 'total', times }
    return times <= 7 ? { kind: 'weekly', times } : { kind: 'total', times }
  }
  const total = t.match(/\b(\d{1,3}|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(libros|kil[oó]metros|km|sesiones|clases|cap[ií]tulos|art[ií]culos)\b/)
  if (total) return { kind: 'total', times: Number(total[1]) || NUMBER_WORDS[total[1]] }
  return MANUAL
}

export function describeTracking(t: GoalTracking): string {
  switch (t.kind) {
    case 'daily': return 'cada día'
    case 'weekly': return `${t.times} ${t.times === 1 ? 'vez' : 'veces'} por semana`
    case 'total': return `${t.times} ${t.times === 1 ? 'vez' : 'veces'} en total`
    default: return 'sin medida fija'
  }
}

/** Días distintos con avance dentro de [from, to]. */
function daysBetween(checkins: GoalCheckin[], from: DayKey, to: DayKey): number {
  return new Set(checkins.filter((c) => c.date >= from && c.date <= to).map((c) => c.date)).size
}

/** Días seguidos con avance hasta hoy (o ayer, si hoy aún no hay). */
export function checkinStreak(checkins: GoalCheckin[], today: DayKey): number {
  const days = new Set(checkins.map((c) => c.date))
  let cursor = days.has(today) ? today : addDays(today, -1)
  let n = 0
  while (days.has(cursor)) {
    n++
    cursor = addDays(cursor, -1)
  }
  return n
}

export interface GoalStatus {
  percent: number
  /** Texto corto para la tarjeta: «3/7 días esta semana». */
  label: string
  /** Para los objetivos «en total»: ya se ha llegado a la meta. */
  reached: boolean
}

export function goalStatus(goal: Goal, today: DayKey): GoalStatus {
  const t = trackingOf(goal)
  const checkins = goal.checkins ?? []
  if (goal.status === 'completed') return { percent: 100, label: 'Completado', reached: true }
  const monday = weekStart(today)
  const sunday = addDays(monday, 6)
  switch (t.kind) {
    case 'daily': {
      const done = daysBetween(checkins, monday, sunday)
      const streak = checkinStreak(checkins, today)
      return { percent: Math.round((done / 7) * 100), label: `${done}/7 días esta semana${streak > 1 ? ` · ${streak} seguidos` : ''}`, reached: false }
    }
    case 'weekly': {
      const done = daysBetween(checkins, monday, sunday)
      return { percent: Math.min(100, Math.round((done / t.times) * 100)), label: done >= t.times ? `¡Cumplido esta semana! (${done}/${t.times})` : `${done} de ${t.times} esta semana`, reached: false }
    }
    case 'total': {
      const done = checkins.length
      return { percent: Math.min(100, Math.round((done / t.times) * 100)), label: `${done} de ${t.times}`, reached: done >= t.times }
    }
    default: {
      const last = checkins.at(-1)
      return { percent: goal.progress, label: last ? `Último avance: ${last.date === today ? 'hoy' : last.date === addDays(today, -1) ? 'ayer' : last.date.split('-').reverse().slice(0, 2).join('/')}` : goal.progress === 0 ? 'Sin empezar' : 'En progreso', reached: false }
    }
  }
}

/**
 * Añade el avance de una entrada. Un mismo día cuenta una vez por entrada:
 * si ya existía, solo se actualiza la nota.
 */
export function withCheckin(checkins: GoalCheckin[] = [], checkin: GoalCheckin): GoalCheckin[] {
  const rest = checkins.filter((c) => !(c.date === checkin.date && c.entryId === checkin.entryId))
  return [...rest, checkin].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
}
