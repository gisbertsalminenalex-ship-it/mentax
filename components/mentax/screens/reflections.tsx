'use client'

import { useEffect, useState } from 'react'
import { Brain, Check, ChevronRight, Heart, LifeBuoy, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { AI_ERROR_MESSAGE, AIUnavailableError, analyzeReflection } from '@/lib/ai/client'
import { formatLong, weekStart } from '@/lib/dates'
import { deleteReflection, saveLearning, toggleFavorite } from '@/lib/db'
import { previewOf } from '@/lib/questions'
import type { Reflection } from '@/lib/types'
import type { AppData } from '../data'
import type { Navigate, Notify } from '../nav'
import { Button, Header, Loading, moodOf } from '../ui'

const TONES = ['violet', 'mint', 'peach']
const FILTERS = ['Todas', 'Esta semana', 'Favoritas'] as const

const minutes = (sec: number) => Math.max(1, Math.round(sec / 60))

export function Reflections({ data, navigate }: { data: AppData; navigate: Navigate }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Todas')
  const thisWeek = weekStart(data.today)
  const list = data.reflections.filter((r) => (filter === 'Favoritas' ? r.favorite : filter === 'Esta semana' ? r.date >= thisWeek : true))

  return <div className="screen scrollable"><Header title="Reflexiones" onBack={() => navigate('home')} action={<button className="icon-button" onClick={() => navigate('reflection')} aria-label="Nueva reflexión"><Plus size={19} /></button>} />
    <div className="tab-row">{FILTERS.map((tab) => <button key={tab} className={filter === tab ? 'selected' : ''} onClick={() => setFilter(tab)}>{tab}</button>)}</div>
    <div className="reflection-list">{list.map((entry, i) => <button className="entry-card" key={entry.id} onClick={() => navigate('detail', entry.id)}>
      <div className={`entry-date ${TONES[i % TONES.length]}`}>{formatLong(entry.date)}{entry.mode === 'brief' && <span className="chip">Breve</span>}{entry.favorite && <Heart size={11} className="fav-mark" />}</div>
      <h3>{entry.title}</h3><p>{previewOf(entry)}</p>
      <div className="entry-footer"><span><Heart size={14} /> {minutes(entry.durationSec)} min de reflexión{entry.analysis && <> · <Sparkles size={12} /> Analizada</>}</span><ChevronRight size={17} /></div>
    </button>)}</div>
    {list.length === 0 && <div className="empty-card">{filter === 'Favoritas' ? 'Aún no tienes reflexiones favoritas. Márcalas con el corazón desde el detalle.' : filter === 'Esta semana' ? 'Esta semana todavía no has escrito ninguna reflexión.' : 'Todavía no hay reflexiones. Empieza hoy: solo son unos minutos.'}{filter !== 'Favoritas' && <Button className="full-button" onClick={() => navigate('reflection')}>Escribir reflexión</Button>}</div>}
    <div className="empty-note"><Sparkles size={16} /> Cada reflexión es una oportunidad para conocerte mejor.</div></div>
}

export function Detail({ reflection, navigate, notify }: { reflection?: Reflection; navigate: Navigate; notify: Notify }) {
  const [confirming, setConfirming] = useState(false)
  if (!reflection) return <Missing navigate={navigate} />
  const mood = moodOf(reflection.mood)

  async function remove() {
    if (!confirming) return setConfirming(true)
    await deleteReflection(reflection!.id)
    notify('Reflexión eliminada')
    navigate('reflections')
  }

  return <div className="screen scrollable"><Header title="Detalle de reflexión" onBack={() => navigate('reflections')} action={<button className={`icon-button ${reflection.favorite ? 'fav-on' : ''}`} onClick={() => toggleFavorite(reflection.id)} aria-label={reflection.favorite ? 'Quitar de favoritas' : 'Añadir a favoritas'} aria-pressed={reflection.favorite}><Heart size={19} fill={reflection.favorite ? 'currentColor' : 'none'} /></button>} />
    <div className="detail-meta"><span>{formatLong(reflection.date)}</span>{mood && <span className="mood"><span>{mood.emoji}</span> {mood.label}</span>}</div>
    <h2 className="detail-title">{reflection.title}</h2>
    {reflection.answers.map((a, i) => <div className="answer-card" key={a.question}><b>{i + 1}. {a.question}</b><p>{a.answer || <em className="muted">Sin respuesta</em>}</p></div>)}
    <div className="button-row"><Button onClick={() => navigate(reflection.mode === 'brief' ? 'brief' : 'reflection', reflection.id)}><Pencil size={16} /> Editar reflexión</Button><button className={`delete-button ${confirming ? 'confirm' : ''}`} onClick={remove} onBlur={() => setConfirming(false)} aria-label="Eliminar reflexión">{confirming ? '¿Borrar?' : <Trash2 size={17} />}</button></div>
    <Button variant="soft" className="full-button" onClick={() => navigate('analysis', reflection.id)}><Sparkles size={16} /> {reflection.analysis ? 'Ver análisis con IA' : 'Analizar con IA'}</Button></div>
}

export function Analysis({ reflection, learnings, navigate, notify }: { reflection?: Reflection; learnings: string[]; navigate: Navigate; notify: Notify }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const analysis = reflection?.analysis
  const id = reflection?.id

  async function run() {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      await analyzeReflection(id)
    } catch (e) {
      setError(e instanceof AIUnavailableError ? e.message : 'No se ha podido completar el análisis.')
    } finally {
      setLoading(false)
    }
  }

  // Primer análisis automático al abrir la pantalla.
  useEffect(() => {
    if (id && !analysis) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!reflection) return <Missing navigate={navigate} />
  const back = () => navigate('detail', reflection.id)
  const saved = !!analysis?.aprendizaje && learnings.includes(analysis.aprendizaje)

  return <div className="screen scrollable"><Header title="Análisis con IA" onBack={back} action={analysis && !loading && <button className="icon-button" onClick={run} aria-label="Volver a analizar"><RefreshCw size={17} /></button>} />
    <div className="ai-hero"><div className="ai-orb"><Brain size={40} /></div><h2>{analysis?.title || 'Algunas notas sobre tu día'}</h2><p>Estas son algunas cosas que quizá quieras tener presentes.</p></div>
    {loading && <Loading text="Mentax está leyendo tu reflexión…" />}
    {!loading && error && <div className="notice-card"><p>{error}</p>{error !== AI_ERROR_MESSAGE['not-configured'] && <Button variant="soft" onClick={run}>Reintentar</Button>}</div>}
    {!loading && analysis && <>
      {analysis.respuesta && <div className="analysis-card reply"><b>Mentax te responde</b><p>{analysis.respuesta}</p></div>}
      {analysis.observacion && <div className="analysis-card"><b>Lo que observo</b><p>{analysis.observacion}</p></div>}
      {analysis.aprendizaje && <div className="analysis-card"><b>Posible aprendizaje</b><p>{analysis.aprendizaje}</p></div>}
      {analysis.sugerencia && <div className="analysis-card"><b>Sugerencia para mañana</b><p>{analysis.sugerencia}</p></div>}
      {analysis.ayudaProfesional && <div className="help-card"><LifeBuoy size={18} /><p>{analysis.ayudaProfesional}</p></div>}
      {analysis.aprendizaje && <Button className="full-button" disabled={saved} onClick={async () => { await saveLearning(analysis.aprendizaje, reflection.id); notify('Aprendizaje guardado') }}>{saved ? 'Aprendizaje guardado' : 'Guardar aprendizaje'} <Check size={16} /></Button>}
      <p className="ai-disclaimer">Mentax es una herramienta de apoyo para reflexionar. No sustituye tu criterio ni la ayuda de un profesional.</p>
    </>}
  </div>
}

function Missing({ navigate }: { navigate: Navigate }) {
  return <div className="screen scrollable"><Header title="Reflexión" onBack={() => navigate('reflections')} /><div className="empty-card">Esta reflexión ya no existe.<Button className="full-button" onClick={() => navigate('reflections')}>Ver reflexiones</Button></div></div>
}
