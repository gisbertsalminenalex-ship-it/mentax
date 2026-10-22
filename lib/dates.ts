/** Fechas en hora local. Las semanas empiezan en lunes. */
import type { DayKey } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

export function dayKey(date: Date = new Date()): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: DayKey, days: number): DayKey {
  const date = parseDayKey(key)
  date.setDate(date.getDate() + days)
  return dayKey(date)
}

/** Lunes de la semana que contiene `key`. */
export function weekStart(key: DayKey): DayKey {
  const date = parseDayKey(key)
  const offset = (date.getDay() + 6) % 7
  return addDays(key, -offset)
}

export function weekDays(start: DayKey): DayKey[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/**
 * Días seguidos con al menos una reflexión. Si hoy aún no hay, la racha
 * sigue viva desde ayer (el día no ha terminado).
 */
export function currentStreak(days: Iterable<DayKey>, today: DayKey): number {
  const set = new Set(days)
  let cursor = set.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (set.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** «Lunes, 20 de mayo de 2024» */
export function formatLong(key: DayKey): string {
  const text = parseDayKey(key).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return capitalize(text.replace(/^(\p{L}+),? /u, '$1, '))
}

/** «MARTES, 21 DE MAYO» */
export function formatEyebrow(key: DayKey): string {
  const text = parseDayKey(key).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  return text.replace(/^(\p{L}+),? /u, '$1, ').toUpperCase()
}

/** «12–18 may» */
export function formatWeekRange(start: DayKey): string {
  const from = parseDayKey(start)
  const to = parseDayKey(addDays(start, 6))
  const month = (d: Date) => d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
  return from.getMonth() === to.getMonth()
    ? `${from.getDate()}–${to.getDate()} ${month(to)}`
    : `${from.getDate()} ${month(from)} – ${to.getDate()} ${month(to)}`
}

export function greeting(hour: number = new Date().getHours()): string {
  if (hour >= 6 && hour < 14) return 'Buenos días'
  if (hour >= 14 && hour < 21) return 'Buenas tardes'
  return 'Buenas noches'
}
