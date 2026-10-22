'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Sparkles, X, Zap } from 'lucide-react'
import { questionsForToday } from '@/lib/ai/client'
import { db, reflectionForDay, saveReflection } from '@/lib/db'
import { BRIEF_QUESTIONS } from '@/lib/questions'
import type { Answer, DailyQuestion, DayKey, Mood } from '@/lib/types'
import type { Navigate, Notify } from '../nav'
import { Button, Header, Loading, MoodPicker } from '../ui'

const MAX_ANSWER = 1000
const MAX_BRIEF = 300

const elapsedSince = (start: number) => Math.round((Date.now() - start) / 1000)

/** Reflexión diaria guiada. Con `editId` edita una existente con sus mismas preguntas. */
export function Reflection({ editId, today, navigate, notify }: { editId?: string; today: DayKey; navigate: Navigate; notify: Notify }) {
  const [questions, setQuestions] = useState<DailyQuestion[] | null>(null)
  const [personalized, setPersonalized] = useState(false)
  const [answers, setAnswers] = useState<string[]>([])
  const [mood, setMood] = useState<Mood>()
  const [step, setStep] = useState(0)
  const [targetId, setTargetId] = useState(editId)
  const [saving, setSaving] = useState(false)
  const started = useRef(Date.now())
  const textarea = useRef<HTMLTextAreaElement>(null)

  // Al cambiar de pregunta el foco va al texto, no al botón (un espacio no debe guardar).
  useEffect(() => {
    textarea.current?.focus()
  }, [step, questions])

  // Una reflexión completa por día: si ya existe la de hoy, se edita.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const existing = editId ? await db.reflections.get(editId) : await reflectionForDay(today, 'full')
      if (existing) {
        if (cancelled) return
        setTargetId(existing.id)
        setQuestions(existing.answers.map((a) => ({ objective: a.objective ?? 'interior', text: a.question, help: '', hints: [] })))
        setAnswers(existing.answers.map((a) => a.answer))
        setMood(existing.mood)
        return
      }
      const { questions, source } = await questionsForToday(today)
      if (cancelled) return
      setQuestions(questions)
      setPersonalized(source === 'ai')
      setAnswers(questions.map(() => ''))
    })()
    return () => { cancelled = true }
  }, [editId, today])

  const back = () => navigate(editId ? 'detail' : 'home', editId)

  if (!questions) return <div className="screen scrollable"><Header title="Reflexión diaria" onBack={back} /><Loading text="Preparando tus preguntas de hoy…" /></div>

  const total = questions.length
  const q = questions[step]
  const answer = answers[step] ?? ''
  const hasContent = answers.some((a) => a.trim())

  async function save() {
    if (!questions || saving) return
    setSaving(true)
    const list: Answer[] = questions.map((q, i) => ({ question: q.text, answer: answers[i]?.trim() ?? '', objective: q.objective }))
    const id = await saveReflection({ date: today, mode: 'full', answers: list, mood, durationSec: elapsedSince(started.current) }, targetId)
    notify(targetId ? 'Reflexión actualizada' : 'Reflexión guardada')
    navigate('detail', id)
  }

  return <div className="screen scrollable"><Header title={targetId ? 'Editar reflexión' : 'Reflexión diaria'} onBack={back} action={!targetId && <button className="icon-button" onClick={() => navigate('brief')} aria-label="Modo breve"><Zap size={18} /></button>} />
    <div className="progress-label"><span>{step + 1} de {total}</span><span>{Math.round(((step + 1) / total) * 100)}%</span></div><div className="progress"><i style={{ width: `${((step + 1) / total) * 100}%` }} /></div>
    <div className="reflection-content">
      <p className="step-kicker">PREGUNTA {step + 1}{personalized && step === 0 && <span className="personal-tag"><Sparkles size={10} /> Pensadas para ti</span>}</p>
      <h2>{q.text}</h2>
      {q.help && <p className="question-help">{q.help}</p>}
      <textarea value={answer} onChange={(e) => setAnswers((a) => a.map((v, i) => (i === step ? e.target.value : v)))} placeholder="Escribe aquí..." maxLength={MAX_ANSWER} ref={textarea} />
      <div className="counter">{answer.length}/{MAX_ANSWER}</div>
      {step === total - 1 && <MoodPicker value={mood} onChange={setMood} />}
      {q.hints.length > 0 && <div className="prompt-card"><b>Preguntas para ayudarte</b>{q.hints.map((h) => <p key={h}>• {h}</p>)}</div>}
      <div className="button-row">{step > 0 && <Button variant="soft" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Anterior</Button>}{step < total - 1 ? <Button onClick={() => setStep(step + 1)}>Siguiente <ArrowRight size={16} /></Button> : <Button onClick={save} disabled={!hasContent || saving}>Guardar reflexión <Check size={16} /></Button>}</div>
      {step === total - 1 && !hasContent && <p className="form-hint">Escribe al menos una respuesta para guardar.</p>}
    </div></div>
}

/** Modo breve: tres preguntas fijas y rápidas. */
export function Brief({ editId, today, navigate, notify }: { editId?: string; today: DayKey; navigate: Navigate; notify: Notify }) {
  const [answers, setAnswers] = useState(['', '', ''])
  const [mood, setMood] = useState<Mood>()
  const [targetId, setTargetId] = useState(editId)
  const [saving, setSaving] = useState(false)
  const started = useRef(Date.now())

  // Si ya hay una reflexión breve hoy (o se edita una), se continúa sobre ella.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const existing = editId ? await db.reflections.get(editId) : (await db.reflections.where('date').equals(today).toArray()).find((r) => r.mode === 'brief')
      if (!existing || cancelled) return
      setTargetId(existing.id)
      setAnswers(BRIEF_QUESTIONS.map((q) => existing.answers.find((a) => a.question === q)?.answer ?? ''))
      setMood(existing.mood)
    })()
    return () => { cancelled = true }
  }, [editId, today])

  const hasContent = answers.some((a) => a.trim())
  const back = () => navigate(editId ? 'detail' : 'home', editId)

  async function save() {
    if (!hasContent || saving) return
    setSaving(true)
    const id = await saveReflection({ date: today, mode: 'brief', answers: BRIEF_QUESTIONS.map((question, i) => ({ question, answer: answers[i].trim() })), mood, durationSec: elapsedSince(started.current) }, targetId)
    notify(targetId ? 'Reflexión actualizada' : 'Reflexión guardada')
    navigate('detail', id)
  }

  return <div className="screen scrollable"><Header title="Modo breve" onBack={back} action={<button className="icon-button" onClick={back} aria-label="Cerrar"><X size={18} /></button>} />
    <div className="brief-intro"><Zap size={17} /><p>Responde solo estas 3 preguntas para una reflexión rápida.</p></div>
    {BRIEF_QUESTIONS.map((q, i) => <label className="brief-field" key={q}><b>{i + 1}. {q}</b><textarea value={answers[i]} onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))} placeholder="Escribe aquí..." maxLength={MAX_BRIEF} /><small>{answers[i].length}/{MAX_BRIEF}</small></label>)}
    <MoodPicker value={mood} onChange={setMood} />
    <Button className="full-button" onClick={save} disabled={!hasContent || saving}>Guardar reflexión <Check size={16} /></Button>
  </div>
}
