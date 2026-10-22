'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Lightbulb, RefreshCw, Sparkles } from 'lucide-react'
import { AIUnavailableError, summarizeWeek } from '@/lib/ai/client'
import { addDays, formatWeekRange, weekDays, weekStart } from '@/lib/dates'
import { db } from '@/lib/db'
import type { Mood, Reflection } from '@/lib/types'
import type { AppData } from '../data'
import type { Navigate } from '../nav'
import { Button, Header, Loading, moodOf } from '../ui'

const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const INSIGHT_TONES = ['violet', 'blue', 'peach']
const HISTORY_WEEKS = 8

/** Ánimo medio de un día (puede haber reflexión completa y breve). */
function dayMood(list: Reflection[]): number | null {
  const moods = list.map((r) => r.mood).filter((m): m is NonNullable<typeof m> => !!m)
  return moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null
}

export function Week({ data, navigate }: { data: AppData; navigate: Navigate }) {
  const current = weekStart(data.today)
  const [start, setStart] = useState(current)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const summary = useLiveQuery(() => db.weekSummaries.get(start), [start])

  const days = weekDays(start)
  const inWeek = data.reflections.filter((r) => r.date >= days[0] && r.date <= days[6])
  const daysDone = new Set(inWeek.map((r) => r.date)).size
  const pct = Math.round((daysDone / 7) * 100)
  const outdated = summary && summary.reflectionCount !== inWeek.length
  const weekLearnings = data.learnings.filter((l) => {
    const r = data.reflections.find((x) => x.id === l.reflectionId)
    return r && r.date >= days[0] && r.date <= days[6]
  })
  const weeks = Array.from({ length: HISTORY_WEEKS }, (_, i) => addDays(current, -7 * i))

  async function generate() {
    setLoading(true)
    setError('')
    try {
      await summarizeWeek(start)
    } catch (e) {
      setError(e instanceof AIUnavailableError ? e.message : 'No se ha podido generar el resumen.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="screen scrollable"><Header title="Mi semana" onBack={() => navigate('home')} action={<select className="week-select" value={start} onChange={(e) => { setStart(e.target.value); setError('') }} aria-label="Elegir semana">{weeks.map((w, i) => <option key={w} value={w}>{i === 0 ? 'Esta semana' : i === 1 ? 'Semana pasada' : formatWeekRange(w)}</option>)}</select>} />
    <div className="summary-card"><div><p>Resumen general</p><small>Has reflexionado {daysDone} de 7 días</small><small className="range">{formatWeekRange(start)}</small></div><div className="ring" style={{ background: `conic-gradient(#8068ee 0 ${pct}%, #e5e0fd ${pct}% 100%)` }}><strong>{pct}%</strong></div></div>

    <h2 className="section-title">Tu ánimo</h2>
    <div className="mood-week">{days.map((d, i) => { const m = dayMood(inWeek.filter((r) => r.date === d)); const mood = m ? moodOf(Math.round(m) as Mood) : undefined; return <div key={d} className={d === data.today ? 'today' : ''}><span className="bar"><i style={{ height: m ? `${(m / 5) * 100}%` : 0 }} /></span><em>{mood?.emoji ?? '·'}</em><small>{DAY_LETTERS[i]}</small></div> })}</div>

    {loading && <Loading text="Preparando el resumen de tu semana…" />}
    {!loading && summary && <>
      {summary.resumen && <div className="analysis-card week-summary"><b>Cómo ha ido</b><p>{summary.resumen}</p></div>}
      {summary.aprendizajes.length > 0 && <><h2 className="section-title">Aprendizajes clave</h2><div className="insight-card">{summary.aprendizajes.map((text, i) => <div className="insight" key={text}><span className={`insight-icon ${INSIGHT_TONES[i % INSIGHT_TONES.length]}`}><Lightbulb size={15} /></span><p>{text}</p></div>)}</div></>}
      {summary.areas.length > 0 && <><h2 className="section-title">Áreas a mejorar</h2><div className="improve-card">{summary.areas.map((a) => <p key={a}><ChevronRight size={14} /> {a}</p>)}</div></>}
    </>}
    {!loading && !summary && weekLearnings.length > 0 && <><h2 className="section-title">Aprendizajes guardados</h2><div className="insight-card">{weekLearnings.map((l, i) => <div className="insight" key={l.id}><span className={`insight-icon ${INSIGHT_TONES[i % INSIGHT_TONES.length]}`}><Lightbulb size={15} /></span><p>{l.text}</p></div>)}</div></>}
    {!loading && error && <div className="notice-card"><p>{error}</p></div>}
    {!loading && inWeek.length === 0 && <div className="empty-card">No hay reflexiones esta semana. Cuando escribas alguna, aquí verás tu resumen.</div>}
    {!loading && inWeek.length > 0 && (!summary || outdated) && <Button className="full-button" onClick={generate}>{summary ? <><RefreshCw size={15} /> Actualizar resumen con IA</> : <><Sparkles size={16} /> Generar resumen con IA</>}</Button>}

    <h2 className="section-title growth-title">Tu evolución</h2>
    <Growth reflections={data.reflections} weeks={[...weeks].reverse()} selected={start} onSelect={setStart} />
  </div>
}

const shortDate = (key: string) => `${Number(key.slice(8))}/${Number(key.slice(5, 7))}`

/** Días reflexionados y ánimo medio de las últimas semanas. */
function Growth({ reflections, weeks, selected, onSelect }: { reflections: Reflection[]; weeks: string[]; selected: string; onSelect: (w: string) => void }) {
  const stats = weeks.map((w) => {
    const end = addDays(w, 6)
    const list = reflections.filter((r) => r.date >= w && r.date <= end)
    return { week: w, days: new Set(list.map((r) => r.date)).size, mood: dayMood(list) }
  })
  if (stats.every((s) => s.days === 0)) return <div className="empty-card">A medida que reflexiones, aquí verás cómo evolucionas semana a semana.</div>
  return <div className="growth-card"><div className="growth-bars">{stats.map((s) => <button key={s.week} className={s.week === selected ? 'selected' : ''} onClick={() => onSelect(s.week)} title={`${formatWeekRange(s.week)}: ${s.days} días`}><span className="bar"><i style={{ height: `${(s.days / 7) * 100}%` }} /></span><em>{s.mood ? s.mood.toFixed(1) : '–'}</em><small>{shortDate(s.week)}</small></button>)}</div><p className="growth-legend">Barras: días con reflexión · Número: ánimo medio (1–5)</p></div>
}
