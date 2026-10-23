'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, CheckCircle2, ChevronRight, CircleDashed, Heart, LifeBuoy, MessageCircleQuestion, Pencil, Plus, Send, Sparkles, Target, Trash2, TrendingUp, X } from 'lucide-react'
import { AI_ERROR_MESSAGE, AIUnavailableError, closeEntry, reflectOnEntry, type ProgressOutcome } from '@/lib/ai/client'
import { formatLong, weekStart } from '@/lib/dates'
import { createGoal, deleteEntry, markGoalHandled, removeCheckin, saveAnswers, saveLearning, toggleFavorite } from '@/lib/db'
import { describeTracking, isSimilarGoal } from '@/lib/goals'
import { previewOf, stageOf, type EntryStage } from '@/lib/entries'
import type { DetectedGoal, Entry } from '@/lib/types'
import type { AppData } from '../data'
import type { Navigate, Notify } from '../nav'
import { Button, Header, Loading, moodOf } from '../ui'

const TONES = ['violet', 'mint', 'peach']
const FILTERS = ['Todas', 'Esta semana', 'Favoritas'] as const
const MAX_ANSWER = 2000

const STAGE_LABEL: Record<EntryStage, { icon: React.ReactNode; text: string }> = {
  written: { icon: <CircleDashed size={13} />, text: 'Sin reflexión de Mentax' },
  questions: { icon: <MessageCircleQuestion size={13} />, text: 'Mentax te ha preguntado' },
  closed: { icon: <CheckCircle2 size={13} />, text: 'Reflexión completa' },
}

export function Diary({ data, navigate }: { data: AppData; navigate: Navigate }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Todas')
  const thisWeek = weekStart(data.today)
  const list = data.entries.filter((e) => (filter === 'Favoritas' ? e.favorite : filter === 'Esta semana' ? e.date >= thisWeek : true))
  const hasToday = data.entries.some((e) => e.date === data.today)

  return <div className="screen scrollable"><Header title="Mi diario" onBack={() => navigate('home')} action={<button className="icon-button" onClick={() => navigate('write')} aria-label={hasToday ? 'Editar la entrada de hoy' : 'Escribir la entrada de hoy'}>{hasToday ? <Pencil size={17} /> : <Plus size={19} />}</button>} />
    <div className="tab-row">{FILTERS.map((tab) => <button key={tab} className={filter === tab ? 'selected' : ''} onClick={() => setFilter(tab)}>{tab}</button>)}</div>
    <div className="reflection-list">{list.map((entry, i) => { const stage = STAGE_LABEL[stageOf(entry)]; return <button className="entry-card" key={entry.id} onClick={() => navigate('entry', entry.id)}>
      <div className={`entry-date ${TONES[i % TONES.length]}`}>{formatLong(entry.date)}{entry.mood && <span className="entry-mood">{moodOf(entry.mood)?.emoji}</span>}{entry.favorite && <Heart size={11} className="fav-mark" />}</div>
      <h3>{entry.title}</h3><p className="clamp">{previewOf(entry)}</p>
      <div className="entry-footer"><span>{stage.icon} {stage.text}</span><ChevronRight size={17} /></div>
    </button> })}</div>
    {list.length === 0 && <div className="empty-card">{filter === 'Favoritas' ? 'Aún no tienes entradas favoritas. Márcalas con el corazón desde la entrada.' : filter === 'Esta semana' ? 'Esta semana todavía no has escrito en tu diario.' : 'Tu diario está vacío. Escribe sobre tu día y Mentax reflexionará contigo.'}{filter !== 'Favoritas' && <Button className="full-button" onClick={() => navigate('write')}>Escribir en el diario</Button>}</div>}
    <div className="empty-note"><Sparkles size={16} /> Cada entrada es una oportunidad para conocerte mejor.</div></div>
}

/** Una entrada del diario y la conversación con Mentax: reflexión → preguntas → cierre. */
export function EntryView({ entry, data, navigate, notify }: { entry?: Entry; data: AppData; navigate: Navigate; notify: Notify }) {
  const [busy, setBusy] = useState<'reflect' | 'close' | null>(null)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const autoStarted = useRef(false)
  const id = entry?.id
  const stage = entry ? stageOf(entry) : 'written'

  // Las respuestas en curso se inicializan desde lo guardado al cambiar de reflexión.
  const reflectionAt = entry?.reflection?.createdAt
  useEffect(() => {
    if (entry) setAnswers(entry.reflection?.preguntas.map((_, i) => entry.answers[i] ?? '') ?? [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reflectionAt])

  function announce({ advanced, completed }: ProgressOutcome) {
    if (completed.length) notify(`¡Objetivo completado: ${completed[0]}!`)
    else if (advanced) notify(advanced === 1 ? 'Mentax ha apuntado un avance en tus objetivos' : `Mentax ha apuntado avances en ${advanced} objetivos`)
  }

  async function reflect() {
    if (!id) return
    setBusy('reflect')
    setError('')
    try {
      announce(await reflectOnEntry(id))
    } catch (e) {
      setError(e instanceof AIUnavailableError ? e.message : 'Mentax no ha podido leer tu entrada.')
    } finally {
      setBusy(null)
    }
  }

  // Al llegar a una entrada sin reflexión, Mentax la lee automáticamente.
  useEffect(() => {
    if (id && stage === 'written' && !autoStarted.current) {
      autoStarted.current = true
      reflect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, stage])

  if (!entry) return <div className="screen scrollable"><Header title="Diario" onBack={() => navigate('diary')} /><div className="empty-card">Esta entrada ya no existe.<Button className="full-button" onClick={() => navigate('diary')}>Ver mi diario</Button></div></div>

  const mood = moodOf(entry.mood)
  const r = entry.reflection
  const pendingGoals = (r?.objetivos ?? []).filter((g) => !entry.handledGoals.includes(g.title) && !data.goals.some((x) => x.status === 'active' && isSimilarGoal(x.title, g.title)))
  // Avances que Mentax ha apuntado a partir de esta entrada.
  const progress = data.goals.flatMap((g) => (g.checkins ?? []).filter((c) => c.entryId === entry.id).map((c) => ({ goal: g, checkin: c })))
  const learningSaved = !!entry.closing?.aprendizaje && data.learnings.some((l) => l.text === entry.closing!.aprendizaje)

  async function sendAnswers() {
    if (!id || !answers.some((a) => a.trim())) return
    setBusy('close')
    setError('')
    await saveAnswers(id, answers)
    try {
      announce(await closeEntry(id, answers))
    } catch (e) {
      setError(e instanceof AIUnavailableError ? e.message : 'Mentax no ha podido leer tus respuestas.')
    } finally {
      setBusy(null)
    }
  }

  async function addGoal(goal: DetectedGoal) {
    await createGoal(goal.title, '', 0, { entryId: entry!.id, tracking: goal.tracking })
    await markGoalHandled(entry!.id, goal.title)
    notify('Añadido a tus objetivos')
  }

  async function remove() {
    if (!confirming) return setConfirming(true)
    await deleteEntry(entry!.id)
    notify('Entrada eliminada')
    navigate('diary')
  }

  const canRetry = error && error !== AI_ERROR_MESSAGE['not-configured']

  return <div className="screen scrollable"><Header title="Entrada del diario" onBack={() => navigate('diary')} action={<button className={`icon-button ${entry.favorite ? 'fav-on' : ''}`} onClick={() => toggleFavorite(entry.id)} aria-label={entry.favorite ? 'Quitar de favoritas' : 'Añadir a favoritas'} aria-pressed={entry.favorite}><Heart size={19} fill={entry.favorite ? 'currentColor' : 'none'} /></button>} />
    <div className="detail-meta"><span>{formatLong(entry.date)}</span>{mood && <span className="mood"><span>{mood.emoji}</span> {mood.label}</span>}</div>
    <h2 className="detail-title">{entry.title}</h2>
    <div className="diary-card"><p>{entry.text}</p></div>

    {busy === 'reflect' && <Loading text="Mentax está leyendo tu entrada…" />}
    {r && busy !== 'reflect' && <>
      <div className="analysis-card reply"><b><Sparkles size={13} /> Mentax reflexiona</b><p>{r.reflexion}</p></div>
      {r.ayudaProfesional && <div className="help-card"><LifeBuoy size={18} /><p>{r.ayudaProfesional}</p></div>}
      {pendingGoals.length > 0 && <div className="goal-suggest"><b><Target size={13} /> Has mencionado estos objetivos</b><p>¿Quieres añadirlos? Mentax irá apuntando tus avances cuando los cuentes en el diario.</p>{pendingGoals.map((g) => <div className="goal-suggest-row" key={g.title}><span>{g.title}<small>Se medirá: {describeTracking(g.tracking)}</small></span><button className="add" onClick={() => addGoal(g)}><Plus size={13} /> Añadir</button><button className="icon-button small" onClick={() => markGoalHandled(entry.id, g.title)} aria-label="Descartar"><X size={14} /></button></div>)}</div>}
    </>}
    {progress.length > 0 && busy === null && <div className="progress-found"><b><TrendingUp size={13} /> Avances en tus objetivos</b>{progress.map(({ goal, checkin }) => <div className="progress-row" key={goal.id}><Check size={14} /><span><em>{goal.title}</em>{checkin.note && <small>{checkin.note}</small>}</span><button className="undo" onClick={async () => { await removeCheckin(goal.id, checkin.date, checkin.entryId); notify('Avance quitado') }}>Deshacer</button></div>)}</div>}

    {r && stage === 'questions' && r.preguntas.length > 0 && busy !== 'reflect' && <>
      <h2 className="section-title qa-title">Para seguir reflexionando</h2>
      {r.preguntas.map((q, i) => <label className="brief-field qa-field" key={q}><b>{i + 1}. {q}</b><textarea value={answers[i] ?? ''} onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))} onBlur={() => saveAnswers(entry.id, answers)} placeholder="Escribe tu respuesta..." maxLength={MAX_ANSWER} disabled={busy === 'close'} /></label>)}
      {busy === 'close' ? <Loading text="Mentax está leyendo tus respuestas…" /> : <Button className="full-button" onClick={sendAnswers} disabled={!answers.some((a) => a.trim())}>Enviar respuestas a Mentax <Send size={15} /></Button>}
    </>}

    {stage === 'closed' && entry.closing && <>
      {qaPairs(entry).length > 0 && <h2 className="section-title qa-title">Tus respuestas</h2>}
      {qaPairs(entry).map(([q, a], i) => <div className="answer-card" key={q}><b>{i + 1}. {q}</b><p>{a || <em className="muted">Sin respuesta</em>}</p></div>)}
      <div className="analysis-card reply closing"><b><Sparkles size={13} /> Mentax cierra el día</b><p>{entry.closing.comentario}</p></div>
      {entry.closing.ayudaProfesional && entry.closing.ayudaProfesional !== r?.ayudaProfesional && <div className="help-card"><LifeBuoy size={18} /><p>{entry.closing.ayudaProfesional}</p></div>}
      {entry.closing.aprendizaje && <div className="analysis-card"><b>Aprendizaje del día</b><p>{entry.closing.aprendizaje}</p></div>}
      {entry.closing.aprendizaje && <Button className="full-button" disabled={learningSaved} onClick={async () => { await saveLearning(entry.closing!.aprendizaje, entry.id); notify('Aprendizaje guardado') }}>{learningSaved ? 'Aprendizaje guardado' : 'Guardar aprendizaje'} <Check size={16} /></Button>}
    </>}

    {error && <div className="notice-card"><p>{error}</p>{canRetry && <Button variant="soft" onClick={stage === 'written' ? reflect : sendAnswers}>Reintentar</Button>}</div>}
    {!busy && stage === 'written' && !error && !autoStarted.current && <Button variant="soft" className="full-button" onClick={reflect}><Sparkles size={16} /> Pedir reflexión a Mentax</Button>}

    <div className="button-row entry-actions"><Button variant="soft" onClick={() => navigate('write', entry.id)}><Pencil size={16} /> Editar entrada</Button><button className={`delete-button ${confirming ? 'confirm' : ''}`} onClick={remove} onBlur={() => setConfirming(false)} aria-label="Eliminar entrada">{confirming ? '¿Borrar?' : <Trash2 size={17} />}</button></div>
    {r && <p className="ai-disclaimer">Mentax es una herramienta de apoyo para reflexionar. No sustituye tu criterio ni la ayuda de un profesional.</p>}
  </div>
}

function qaPairs(entry: Entry): [string, string][] {
  return (entry.reflection?.preguntas ?? []).map((q, i) => [q, entry.answers[i]?.trim() ?? ''])
}
