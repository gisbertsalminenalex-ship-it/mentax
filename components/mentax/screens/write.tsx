'use client'

import { useEffect, useRef, useState } from 'react'
import { Lightbulb, Send } from 'lucide-react'
import { ideasForToday } from '@/lib/ai/client'
import { formatLong } from '@/lib/dates'
import { db, entryForDay, saveEntry } from '@/lib/db'
import type { DayKey, Entry, Mood } from '@/lib/types'
import type { Navigate, Notify } from '../nav'
import { Button, Header, Loading, MoodPicker } from '../ui'

const MAX_TEXT = 6000

/** Escribir (o editar) la entrada del diario. Una entrada por día. */
export function Write({ editId, today, navigate, notify }: { editId?: string; today: DayKey; navigate: Navigate; notify: Notify }) {
  const [existing, setExisting] = useState<Entry | null | undefined>(undefined)
  const [text, setText] = useState('')
  const [mood, setMood] = useState<Mood>()
  const [ideas, setIdeas] = useState<string[] | null>(null)
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [saving, setSaving] = useState(false)
  const started = useRef(Date.now())
  const textarea = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const found = (editId ? await db.reflections.get(editId) : await entryForDay(today)) ?? null
      if (cancelled) return
      setExisting(found)
      if (found) {
        setText(found.text)
        setMood(found.mood)
      }
    })()
    return () => { cancelled = true }
  }, [editId, today])

  const back = () => navigate(existing ? 'entry' : 'home', existing?.id)

  if (existing === undefined) return <div className="screen scrollable"><Header title="Mi diario" onBack={back} /><Loading text="Abriendo tu diario…" /></div>

  const date = existing?.date ?? today
  const changed = !existing || existing.text !== text.trim()
  const hasConversation = !!existing?.reflection

  async function showIdeas() {
    setLoadingIdeas(true)
    const { ideas } = await ideasForToday(today)
    setIdeas(ideas)
    setLoadingIdeas(false)
  }

  function addIdea(idea: string) {
    setText((t) => (t.trim() ? `${t.trimEnd()}\n\n${idea}\n` : `${idea}\n`))
    textarea.current?.focus()
  }

  async function save() {
    if (!text.trim() || saving) return
    setSaving(true)
    const id = await saveEntry({ date, text, mood, durationSec: Math.round((Date.now() - started.current) / 1000) }, existing?.id)
    notify(existing ? 'Entrada actualizada' : 'Entrada guardada')
    navigate('entry', id, { replace: true })
  }

  return <div className="screen scrollable"><Header title={existing ? 'Editar entrada' : 'Mi diario de hoy'} onBack={back} />
    <p className="eyebrow write-date">{formatLong(date).toUpperCase()}</p>
    <MoodPicker value={mood} onChange={setMood} />
    <textarea ref={textarea} className="diary-textarea" value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_TEXT} autoFocus={!existing}
      placeholder="¿Qué tal ha ido el día? Escribe con libertad: lo que has hecho, cómo te has sentido, lo que te preocupa o lo que quieres conseguir esta semana…" />
    <div className="counter">{text.length}/{MAX_TEXT}</div>

    {ideas ? <div className="prompt-card ideas"><b>Ideas para escribir</b>{ideas.map((idea) => <button key={idea} type="button" onClick={() => addIdea(idea)}>{idea}</button>)}</div>
      : <Button variant="ghost" className="idea-button" onClick={showIdeas} disabled={loadingIdeas}><Lightbulb size={15} /> {loadingIdeas ? 'Buscando ideas…' : '¿No sabes qué escribir? Dame una idea'}</Button>}

    {hasConversation && changed && <div className="notice-card"><p>Si cambias el texto, Mentax volverá a leer tu entrada y empezaréis una conversación nueva.</p></div>}
    <Button className="full-button" onClick={save} disabled={!text.trim() || saving}>{hasConversation && !changed ? 'Guardar' : <>Enviar a Mentax <Send size={15} /></>}</Button>
    <p className="form-hint">Mentax leerá tu entrada, reflexionará sobre ella y te hará un par de preguntas.</p>
  </div>
}
