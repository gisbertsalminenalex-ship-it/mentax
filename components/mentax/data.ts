'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { currentStreak, dayKey } from '@/lib/dates'
import { db, getProfile, listEntries } from '@/lib/db'
import type { Entry, Goal, Learning, Profile } from '@/lib/types'

export interface AppData {
  profile: Profile
  entries: Entry[]
  goals: Goal[]
  learnings: Learning[]
  streak: number
  today: string
}

/** Datos vivos de la base local; undefined mientras cargan. */
export function useAppData(): AppData | undefined {
  const profile = useLiveQuery(getProfile)
  const entries = useLiveQuery(listEntries)
  const goals = useLiveQuery(() => db.goals.orderBy('createdAt').toArray())
  const learnings = useLiveQuery(() => db.learnings.orderBy('createdAt').reverse().toArray())
  if (!profile || !entries || !goals || !learnings) return undefined
  const today = dayKey()
  return { profile, entries, goals, learnings, today, streak: currentStreak(entries.map((e) => e.date), today) }
}
