'use client'

import { useState } from 'react'
import { BookOpen, CalendarDays, Check, Target, WandSparkles } from 'lucide-react'
import { formatEyebrow, greeting, parseDayKey, weekDays, weekStart } from '@/lib/dates'
import { saveProfile } from '@/lib/db'
import { stageOf } from '@/lib/entries'
import type { AppData } from '../data'
import type { Navigate } from '../nav'
import { ActionRow, Button, Logo } from '../ui'

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const TODAY_COPY = {
  none: { subtitle: 'Cuéntale a Mentax qué tal tu día', card: 'Escribe sobre tu día y Mentax reflexionará contigo.', button: 'Escribir' },
  written: { subtitle: 'Mentax aún no ha leído tu entrada', card: 'Tu entrada está guardada. Pide a Mentax que la lea.', button: 'Continuar' },
  questions: { subtitle: 'Mentax te ha hecho unas preguntas', card: 'Mentax te ha dejado un par de preguntas para seguir reflexionando.', button: 'Responder' },
  closed: { subtitle: 'Reflexión de hoy completada · Ver', card: 'Hoy ya has cerrado tu reflexión. ¡Bien hecho!', button: 'Ver' },
}

export function Home({ data, navigate }: { data: AppData; navigate: Navigate }) {
  const { profile, entries, goals, streak, today } = data
  const done = new Set(entries.map((e) => e.date))
  const todays = entries.find((e) => e.date === today)
  const copy = TODAY_COPY[todays ? stageOf(todays) : 'none']
  const openToday = () => (todays ? navigate('entry', todays.id) : navigate('write'))
  const activeGoals = goals.filter((g) => g.status === 'active')
  const weekStartMs = parseDayKey(weekStart(today)).getTime()
  const weekGoals = activeGoals.filter((g) => g.createdAt >= weekStartMs)
  const isWeekend = [0, 6].includes(parseDayKey(today).getDay())
  const [name, setName] = useState('')

  return <div className="screen scrollable home-screen">
    <header className="home-header"><div className="brand"><Logo /><span>Mentax</span></div></header>
    <section className="welcome"><p className="eyebrow">{formatEyebrow(today)}</p><h1>{greeting()}{profile.name ? `, ${profile.name}` : ''}</h1><p>Pequeños pasos cada día,<br />grandes cambios siempre.</p></section>
    {!profile.name && <form className="name-card" onSubmit={(e) => { e.preventDefault(); if (name.trim()) saveProfile({ ...profile, name }) }}><b>¿Cómo quieres que te llame?</b><div><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" maxLength={40} /><Button type="submit" disabled={!name.trim()}>Guardar</Button></div></form>}
    <section className="streak-card"><div><p>Tu racha actual</p><strong>{streak}</strong><small>{streak === 1 ? 'día' : 'días'}</small></div><div className="streak-days">{weekDays(weekStart(today)).map((day, i) => <div key={day}><i className={`${done.has(day) ? 'done' : ''} ${day === today ? 'today' : ''}`}>{done.has(day) ? <Check size={10} /> : ''}</i><small>{DAY_LETTERS[i]}</small></div>)}</div></section>
    {isWeekend && weekGoals.length > 0 && <button className="goal-checkin" onClick={() => navigate('goals')}><Target size={17} /><span><b>¿Cómo han ido tus objetivos de esta semana?</b><small>{weekGoals.map((g) => g.title).join(' · ')}</small></span></button>}
    <section className="quick-section"><div className="section-heading"><h2>Acciones rápidas</h2></div>
      <ActionRow icon={<BookOpen />} tone="violet" title="Mi diario de hoy" subtitle={copy.subtitle} onClick={openToday} />
      <ActionRow icon={<Target />} tone="peach" title="Objetivos" subtitle={activeGoals.length ? `${activeGoals.length} ${activeGoals.length === 1 ? 'objetivo activo' : 'objetivos activos'}` : 'Crea tu primer objetivo'} onClick={() => navigate('goals')} />
      <ActionRow icon={<CalendarDays />} tone="mint" title="Mi semana" subtitle="Resumen y aprendizajes" onClick={() => navigate('week')} />
    </section>
    <section className="start-card"><div className="start-icon"><WandSparkles size={19} /></div><div><h3>Un momento para ti</h3><p>{copy.card}</p></div><Button onClick={openToday}>{copy.button}</Button></section>
  </div>
}
