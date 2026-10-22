'use client'

import { useState } from 'react'
import { CalendarDays, Check, Sparkles, Target, WandSparkles, Zap } from 'lucide-react'
import { formatEyebrow, greeting, weekDays, weekStart } from '@/lib/dates'
import { saveProfile } from '@/lib/db'
import type { AppData } from '../data'
import type { Navigate } from '../nav'
import { ActionRow, Button, Logo } from '../ui'

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export function Home({ data, navigate }: { data: AppData; navigate: Navigate }) {
  const { profile, reflections, goals, streak, today } = data
  const done = new Set(reflections.map((r) => r.date))
  const todays = reflections.find((r) => r.date === today && r.mode === 'full')
  const activeGoals = goals.filter((g) => g.status === 'active').length
  const [name, setName] = useState('')

  return <div className="screen scrollable home-screen">
    <header className="home-header"><div className="brand"><Logo /><span>Mentax</span></div></header>
    <section className="welcome"><p className="eyebrow">{formatEyebrow(today)}</p><h1>{greeting()}{profile.name ? `, ${profile.name}` : ''}</h1><p>Pequeños pasos cada día,<br />grandes cambios siempre.</p></section>
    {!profile.name && <form className="name-card" onSubmit={(e) => { e.preventDefault(); if (name.trim()) saveProfile({ ...profile, name }) }}><b>¿Cómo quieres que te llame?</b><div><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" maxLength={40} /><Button type="submit" disabled={!name.trim()}>Guardar</Button></div></form>}
    <section className="streak-card"><div><p>Tu racha actual</p><strong>{streak}</strong><small>{streak === 1 ? 'día' : 'días'}</small></div><div className="streak-days">{weekDays(weekStart(today)).map((day, i) => <div key={day}><i className={`${done.has(day) ? 'done' : ''} ${day === today ? 'today' : ''}`}>{done.has(day) ? <Check size={10} /> : ''}</i><small>{DAY_LETTERS[i]}</small></div>)}</div></section>
    <section className="quick-section"><div className="section-heading"><h2>Acciones rápidas</h2></div>
      <ActionRow icon={<Sparkles />} tone="violet" title="Reflexión diaria" subtitle={todays ? 'Ya has reflexionado hoy · Ver' : 'Escribe tu reflexión de hoy'} onClick={() => (todays ? navigate('detail', todays.id) : navigate('reflection'))} />
      <ActionRow icon={<Target />} tone="peach" title="Objetivos" subtitle={activeGoals ? `${activeGoals} ${activeGoals === 1 ? 'objetivo activo' : 'objetivos activos'}` : 'Crea tu primer objetivo'} onClick={() => navigate('goals')} />
      <ActionRow icon={<CalendarDays />} tone="mint" title="Mi semana" subtitle="Resumen y aprendizajes" onClick={() => navigate('week')} />
    </section>
    <section className="start-card"><div className="start-icon"><WandSparkles size={19} /></div><div><h3>Un momento para ti</h3><p>{todays ? 'Puedes completar o editar lo de hoy.' : 'Dedica 5 minutos a entender tu día.'}</p></div><Button onClick={() => navigate('reflection', todays?.id)}>{todays ? 'Editar' : 'Comenzar'}</Button></section>
    <Button variant="ghost" className="full-button brief-link" onClick={() => navigate('brief')}><Zap size={15} /> ¿Poco tiempo? Modo breve</Button>
  </div>
}
