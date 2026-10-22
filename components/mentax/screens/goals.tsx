'use client'

import { useState } from 'react'
import { Check, Plus, RotateCcw, Target, Trash2 } from 'lucide-react'
import { createGoal, deleteGoal, updateGoal } from '@/lib/db'
import type { Goal } from '@/lib/types'
import type { AppData } from '../data'
import type { Navigate, Notify } from '../nav'
import { Button, Header } from '../ui'

const TABS = [['active', 'Activos'], ['completed', 'Completados'], ['all', 'Todos']] as const

export function Goals({ data, navigate }: { data: AppData; navigate: Navigate }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('active')
  const goals = data.goals.filter((g) => tab === 'all' || g.status === tab)

  return <div className="screen scrollable"><Header title="Objetivos" onBack={() => navigate('home')} action={<button className="round-plus" onClick={() => navigate('goal')} aria-label="Nuevo objetivo"><Plus size={18} /></button>} />
    <div className="tab-row goal-tabs">{TABS.map(([id, label]) => <button key={id} className={tab === id ? 'selected' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
    <div className="goals-list">{goals.map((g) => <button className="goal-card" key={g.id} onClick={() => navigate('goal', g.id)}><span className={`goal-icon ${g.tone}`}>{g.status === 'completed' ? <Check size={17} /> : <Target size={17} />}</span><span className="goal-info"><b>{g.title}</b><small>{g.status === 'completed' ? 'Completado' : g.progress === 0 ? 'Sin empezar' : 'En progreso'}</small><span className="goal-progress"><i style={{ width: `${g.progress}%` }} /></span><em>{g.progress}%</em></span></button>)}</div>
    {goals.length === 0 && <div className="empty-card">{tab === 'completed' ? 'Aún no has completado ningún objetivo. ¡Todo llegará!' : 'Todavía no tienes objetivos. Ponte una meta y sigue tu progreso aquí.'}</div>}
    <Button variant="soft" className="full-button" onClick={() => navigate('goal')}><Plus size={16} /> Añadir objetivo</Button></div>
}

/** Crear o editar un objetivo. */
export function GoalEditor({ goal, navigate, notify }: { goal?: Goal; navigate: Navigate; notify: Notify }) {
  const [title, setTitle] = useState(goal?.title ?? '')
  const [description, setDescription] = useState(goal?.description ?? '')
  const [progress, setProgress] = useState(goal?.progress ?? 0)
  const [confirming, setConfirming] = useState(false)
  const back = () => navigate('goals')

  async function save() {
    if (!title.trim()) return
    if (goal) await updateGoal(goal.id, { title, description, progress })
    else await createGoal(title, description, progress)
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

  return <div className="screen scrollable"><Header title={goal ? 'Editar objetivo' : 'Nuevo objetivo'} onBack={back} />
    <form className="form-stack" onSubmit={(e) => { e.preventDefault(); save() }}>
      <label className="field"><b>¿Qué quieres conseguir?</b><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Hacer ejercicio regularmente" maxLength={80} autoFocus={!goal} /></label>
      <label className="field"><b>¿Por qué es importante para ti? <span className="optional">(opcional)</span></b><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Escribe aquí..." maxLength={300} /></label>
      <label className="field"><b>Progreso <span className="progress-value">{progress}%</span></b><input type="range" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="range" style={{ '--pct': `${progress}%` } as React.CSSProperties} /></label>
      <Button type="submit" className="full-button" disabled={!title.trim()}>Guardar <Check size={16} /></Button>
    </form>
    {goal && <div className="button-row goal-actions"><Button variant="soft" onClick={toggleStatus}>{goal.status === 'active' ? <><Check size={16} /> Marcar como completado</> : <><RotateCcw size={15} /> Reactivar</>}</Button><button className={`delete-button ${confirming ? 'confirm' : ''}`} onClick={remove} onBlur={() => setConfirming(false)} aria-label="Eliminar objetivo">{confirming ? '¿Borrar?' : <Trash2 size={17} />}</button></div>}
  </div>
}
