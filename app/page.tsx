'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppData } from '@/components/mentax/data'
import type { Navigate, Route } from '@/components/mentax/nav'
import { Home } from '@/components/mentax/screens/home'
import { Write } from '@/components/mentax/screens/write'
import { Diary, EntryView } from '@/components/mentax/screens/diary'
import { Week } from '@/components/mentax/screens/week'
import { GoalEditor, Goals } from '@/components/mentax/screens/goals'
import { Profile } from '@/components/mentax/screens/profile'
import { BottomNav, Loading, TAB_SCREENS } from '@/components/mentax/ui'

export default function Page() {
  const [route, setRoute] = useState<Route>({ screen: 'home' })
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const data = useAppData()

  // Cada pantalla es una entrada del historial: el gesto «atrás» del móvil funciona.
  useEffect(() => {
    history.replaceState({ screen: 'home' } satisfies Route, '')
    const onPop = (e: PopStateEvent) => setRoute((e.state as Route | null) ?? { screen: 'home' })
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate: Navigate = useCallback((screen, id, options) => {
    const next: Route = { screen, id }
    if (options?.replace) history.replaceState(next, '')
    else history.pushState(next, '')
    setRoute(next)
    window.scrollTo(0, 0)
  }, [])

  const notify = useCallback((message: string) => {
    setToast(message)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2600)
  }, [])

  if (!data) return <main className="app-shell"><div className="phone-frame"><div className="screen"><Loading text="Cargando…" /></div></div></main>

  const { screen, id } = route
  const props = { data, navigate, notify }
  const content = {
    home: <Home {...props} />,
    write: <Write key={id ?? 'new'} editId={id} today={data.today} navigate={navigate} notify={notify} />,
    diary: <Diary {...props} />,
    entry: <EntryView key={id} entry={id ? data.entries.find((e) => e.id === id) : undefined} {...props} />,
    week: <Week {...props} />,
    goals: <Goals {...props} />,
    goal: <GoalEditor key={id ?? 'new'} goal={id ? data.goals.find((g) => g.id === id) : undefined} {...props} />,
    profile: <Profile {...props} />,
  }[screen]

  return <main className="app-shell"><div className="phone-frame">{content}{TAB_SCREENS.includes(screen) && <BottomNav active={screen} navigate={navigate} />}{toast && <div className="toast" role="status">{toast}</div>}</div></main>
}
