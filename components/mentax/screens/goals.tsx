'use client'

import { useState } from 'react'
import { BookOpen, Check, Plus, RotateCcw, Target, Trash2, X } from 'lucide-react'
import { formatLong } from '@/lib/dates'
import { addManualCheckin, createGoal, deleteGoal, removeCheckin, updateGoal } from '@/lib/db'
import { describeTracking, goalStatus, guessTracking, normalizeTracking, trackingOf } from '@/lib/goals'
import type { Goal, GoalTracking } from '@/lib/types'
import type { AppData } from '../data'
import type { Navigate, Notify } from '../nav'
import { Button, Header } from '../ui'

const TABS = [['active', 'Activos'], ['completed', 'Completados'], ['all', 'Todos']] as const

const KINDS: { kind: GoalTracking['kind']; label: string }[] = [
  { kind: 'daily', label: 'Cada día' },
  { kind: 'weekly', label: 'Por semana' },
  { kind: 'total', label: 'En total' },
  { kind: 'manual', label: 'Manual' },
]

export function Goals({ data, navigate }: { data: AppData; navigate: Navigate }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('active')
  const goals = data.goals.filter((g) => tab === 'all' || g.status === tab)

  return <div className="screen scrollable"><Header title="Objetivos" onBack={() => navigate('home')} action={<button className="round-plus" onClick={() => navigate('goal')} aria-label="Nuevo objetivo"><Plus size={18} /></button>} />
    <div className="tab-row goal-tabs">{TABS.map(([id, label]) => <button key={id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
    <div className="goals-list">{goals.map((g) => { const s = goalStatus(g, data.today); return <button className="goal-card" key={g.id} onClick={() => navigate('goal', g.id)}><span className={`goal-icon ${g.tone}`}>{g.status === 'completed' ? <Check size={17} /> : <Target size={17} />}</span><span className="goal-info"><b>{g.title}</b><small>{s.label}{g.entryId && ' · Del diario'}</small><span className="goal-progress"><i style={{ width: `${s.percent}%` }} /></span><em>{s.percent}%</em></span></button> })}</div>
    {goals.length === 0 && <div className="empty-card">{tab === 'completed' ? 'Aún no has completado ningún objetivo. ¡Todo llegará!' : 'Todavía no tienes objetivos. Escríbelos en tu diario («esta semana quiero…») o añádelos aquí.'}</div>}
    <Button variant="soft" className="full-button" onClick={() => navigate('goal')}><Plus size={16} /> Añadir objetivo</Button>
    {tab === 'active' && goals.some((g) => trackingOf(g).kind !== 'manual') && <p className="form-hint">Mentax rellena la barra sola cuando cuentas en el diario que has avanzado.</p>}
  </div>
}

/** Crear o editar un objetivo, con su forma de medirse y el historial de avances. */
export function GoalEditor({ goal, data, navigate, notify }: { goal?: Goal; data: AppData; navigate: Navigate; notify: Notify }) {
  const [title, setTitle] = useState(goal?.title ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [progress, setProgress] = useState(goal?.progress ?? 0)
  const [tracking, setTracking] = useState<GoalTracking>(goal ? trackingOf(goal) : { kind: 'manual' })
  // En un objetivo nuevo, la forma de medir se deduce del título hasta que el usuario la elige.
  const [trackingTouched, setTrackingTouched] = useState(!!goal)
  const [confirming, setConfirming] = useState(false)
  const back = () => navigate('goals')
  const today = data.today
  const checkins = [...(goal?.checkins ?? [])].reverse()
  const doneToday = goal?.checkins?.some((c) => c.date === today)
  const times = tracking.kind === 'weekly' || tracking.kind === 'total' ? tracking.times : 3

  function changeTitle(value: string) {
    setTitle(value)
    if (!trackingTouched) setTracking(guessTracking(value))
  }

  function chooseKind(kind: GoalTracking['kind']) {
    setTrackingTouched(true)
    setTracking(kind === 'weekly' || kind === 'total' ? normalizeTracking({ kind, times }) : { kind })
  }

  async function save() {
    if (!title.trim()) return
    if (goal) await updateGoal(goal.id, { title, description, progress, tracking })
    else await createGoal(title, description, progress, { tracking })
    notify(goal ? 'Objetivo actualizado' : 'Objetivo creado')
    back()
  }

  async function toggleStatus() {
    if (!goal) return
    const completing = goal.status === 'active'
    await updateGoal(goal.id, completing ? { title, description, status: 'completed' } : { title, description, progress: Math.min(progress, 90), status: 'active' })
    notify(completing ? '¡Objetivo completado!' : 'Objetivo reactivado')
    back()
  }

  async function remove() {
    if (!goal) return
    if (!confirming) return setConfirming(true)
    await deleteGoal(goal.id)
    notify('Objetivo eliminado')
    back()
  }

  const status = goal ? goalStatus(goal, today) : null

  return <div className="screen scrollable"><Header title={goal ? 'Editar objetivo' : 'Nuevo objetivo'} onBack={back} />
    {goal && status && <div className="goal-summary"><div><b>{status.label}</b><small>Se mide {describeTracking(trackingOf(goal))}</small></div><div className="ring" style={{ background: `conic-gradient(#8068ee 0 ${status.percent}%, #e5e0fd ${status.percent}% 100%)` }}><strong>{status.percent}%</strong></div></div>}
    {goal?.status === 'active' && <Button variant="soft" className="full-button checkin-button" disabled={doneToday} onClick={async () => { await addManualCheckin(goal.id, today, ''); notify('Avance de hoy apuntado') }}>{doneToday ? <><Check size={15} /> Hoy ya cuenta</> : <><Plus size={15} /> He avanzado hoy</>}</Button>}

    <form className="form-stack goal-form" onSubmit={(e) => { e.preventDefault(); save() }}>
      <label className="field"><b>¿Qué quieres conseguir?</b><input value={title} onChange={(e) => changeTitle(e.target.value)} placeholder="Ej.: Hacer ejercicio cada día" maxLength={80} autoFocus={!goal} /></label>
      <div className="field"><b>¿Cómo se mide?</b>
        <div className="tab-row kind-row">{KINDS.map(({ kind, label }) => <button type="button" key={kind} className={tracking.kind === kind ? 'selected' : ''} onClick={() => chooseKind(kind)}>{label}</button>)}</div>
        {(tracking.kind === 'weekly' || tracking.kind === 'total') && <label className="times-field"><input type="number" min={1} max={tracking.kind === 'weekly' ? 7 : 100} value={tracking.times} onChange={(e) => { setTrackingTouched(true); setTracking(normalizeTracking({ kind: tracking.kind, times: Number(e.target.value) } as GoalTracking)) }} /> {tracking.kind === 'weekly' ? 'veces por semana' : 'veces en total'}</label>}
        <small className="field-help">{tracking.kind === 'manual' ? 'Tú mueves la barra. Mentax igualmente apunta los días en que avanzas.' : tracking.kind === 'total' ? 'Cada avance suma uno. Al llegar a la meta se completa solo.' : 'La barra se llena con los días que avanzas y empieza de nuevo cada lunes.'}</small>
      </div>
      {tracking.kind === 'manual' && <label className="field"><b>Progreso <span className="progress-value">{progress}%</span></b><input type="range" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="range" style={{ '--pct': `${progress}%` } as React.CSSProperties} /></label>}
      <label className="field"><b>¿Por qué es importante para ti? <span className="optional">(opcional)</span></b><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Escribe aquí..." maxLength={300} /></label>
      <Button type="submit" className="full-button" disabled={!title.trim()}>Guardar <Check size={16} /></Button>
    </form>

    {goal && <>
      <h2 className="section-title history-title">Tus avances</h2>
      {checkins.length ? <div className="checkin-list">{checkins.map((c) => <div className="checkin-row" key={`${c.date}-${c.entryId ?? 'manual'}`}><Check size={14} /><span><b>{formatLong(c.date)}</b>{c.note && <small>{c.note}</small>}</span>{c.entryId ? <button className="icon-button small" onClick={() => navigate('entry', c.entryId)} aria-label="Ver la entrada del diario"><BookOpen size={14} /></button> : null}<button className="icon-button small" onClick={() => removeCheckin(goal.id, c.date, c.entryId)} aria-label="Quitar avance"><X size={14} /></button></div>)}</div>
        : <div className="empty-card">Todavía no hay avances. Cuando cuentes en tu diario que has avanzado, Mentax lo apuntará aquí.</div>}
      <div className="button-row goal-actions"><Button variant="soft" onClick={toggleStatus}>{goal.status === 'active' ? <><Check size={16} /> Marcar como completado</> : <><RotateCcw size={15} /> Reactivar</>}</Button><button className={`delete-button ${confirming ? 'confirm' : ''}`} onClick={remove} onBlur={() => setConfirming(false)} aria-label="Eliminar objetivo">{confirming ? '¿Borrar?' : <Trash2 size={17} />}</button></div>
    </>}
  </div>
}
