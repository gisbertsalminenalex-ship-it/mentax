'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { currentStreak, dayKey } from '@/lib/dates'
import { db, getProfile, listReflections } from '@/lib/db'
import type { Goal, Learning, Profile, Reflection } from '@/lib/types'

export interface AppData {
  profile: Profile
  reflections: Reflection[]
  goals: Goal[]
  learnings: Learning[]
  streak: number
  today: string
}

/** Datos vivos de la base local; undefined mientras cargan. */
export function useAppData(): AppData | undefined {
  const profile = useLiveQuery(getProfile)
  const reflections = useLiveQuery(listReflections)
  const goals = useLiveQuery(() => db.goals.orderBy('createdAt').toArray())
  const learnings = useLiveQuery(() => db.learnings.orderBy('createdAt').reverse().toArray())
  if (!profile || !reflections || !goals || !learnings) return undefined
  const today = dayKey()
  return { profile, reflections, goals, learnings, today, streak: currentStreak(reflections.map((r) => r.date), today) }
}
