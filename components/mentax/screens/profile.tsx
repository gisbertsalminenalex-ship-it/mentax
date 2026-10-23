'use client'

import { useRef, useState } from 'react'
import { ChevronDown, ChevronRight, CircleHelp, Download, Heart, Lightbulb, Pencil, Trash2, Upload, X } from 'lucide-react'
import { backupFileName, buildBackup, parseBackup, restoreBackup } from '@/lib/backup'
import { clearAll, deleteLearning, saveProfile } from '@/lib/db'
import type { AppData } from '../data'
import type { Navigate, Notify } from '../nav'
import { Button, Header, Logo } from '../ui'

type Panel = 'privacy' | 'help' | null

export function Profile({ data, navigate, notify }: { data: AppData; navigate: Navigate; notify: Notify }) {
  const { profile } = data
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile.name)
  const [tagline, setTagline] = useState(profile.tagline)
  const [panel, setPanel] = useState<Panel>(null)
  const [pendingRestore, setPendingRestore] = useState<ReturnType<typeof parseBackup> | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const activeGoals = data.goals.filter((g) => g.status === 'active').length

  async function exportBackup() {
    const backup = await buildBackup()
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = backupFileName()
    a.click()
    URL.revokeObjectURL(url)
    notify('Copia de seguridad descargada')
  }

  async function pickFile(file?: File) {
    if (!file) return
    try {
      setPendingRestore(parseBackup(await file.text()))
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se ha podido leer el archivo.')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function confirmRestore() {
    if (!pendingRestore) return
    await restoreBackup(pendingRestore)
    setPendingRestore(null)
    notify('Copia restaurada')
  }

  async function clearEverything() {
    if (!confirmClear) return setConfirmClear(true)
    await clearAll()
    setConfirmClear(false)
    notify('Se han borrado todos los datos')
    navigate('home')
  }

  const toggle = (p: Panel) => setPanel(panel === p ? null : p)

  return <div className="screen scrollable"><Header title="Perfil" onBack={() => navigate('home')} />
    {editing ? <form className="form-stack profile-form" onSubmit={async (e) => { e.preventDefault(); await saveProfile({ name, tagline }); setEditing(false); notify('Perfil guardado') }}>
      <label className="field"><b>Nombre</b><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus /></label>
      <label className="field"><b>Tu frase</b><input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={80} /></label>
      <div className="button-row"><Button variant="soft" onClick={() => { setName(profile.name); setTagline(profile.tagline); setEditing(false) }}>Cancelar</Button><Button type="submit">Guardar</Button></div>
    </form> : <div className="profile-head"><div className="avatar">{(profile.name || 'M').charAt(0).toUpperCase()}</div><div><h2>{profile.name || 'Sin nombre'}</h2><p>{profile.tagline}</p></div><button className="edit-icon" onClick={() => { setName(profile.name); setTagline(profile.tagline); setEditing(true) }} aria-label="Editar perfil"><Pencil size={15} /></button></div>}

    <div className="profile-stats"><div><strong>{data.streak}</strong><small>Días de racha</small></div><div><strong>{data.entries.length}</strong><small>Entradas</small></div><div><strong>{activeGoals}</strong><small>Objetivos</small></div></div>

    <h2 className="section-title">Mis aprendizajes</h2>
    {data.learnings.length ? <div className="insight-card learnings">{data.learnings.map((l) => <div className="insight" key={l.id}><span className="insight-icon violet"><Lightbulb size={15} /></span><p>{l.text}</p><button className="icon-button small" onClick={() => deleteLearning(l.id)} aria-label="Olvidar aprendizaje"><X size={14} /></button></div>)}</div>
      : <div className="empty-card">Cuando guardes el aprendizaje del día al cerrar una reflexión, aparecerá aquí. Mentax lo tiene en cuenta en los días siguientes.</div>}

    <h2 className="section-title">Tus datos</h2>
    <button className="setting-row" onClick={exportBackup}><span><Download size={17} /></span><b>Exportar copia de seguridad</b><ChevronRight size={16} /></button>
    <button className="setting-row" onClick={() => fileInput.current?.click()}><span><Upload size={17} /></span><b>Restaurar una copia</b><ChevronRight size={16} /></button>
    <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
    {pendingRestore && <div className="notice-card"><p>Esta copia del {new Date(pendingRestore.exportedAt).toLocaleDateString('es-ES')} tiene {pendingRestore.data.reflections.length} entradas del diario y {pendingRestore.data.goals.length} objetivos. <b>Sustituirá todos tus datos actuales.</b></p><div className="button-row"><Button variant="soft" onClick={() => setPendingRestore(null)}>Cancelar</Button><Button onClick={confirmRestore}>Restaurar</Button></div></div>}

    <h2 className="section-title settings-title">Preferencias</h2>
    <button className="setting-row" onClick={() => toggle('privacy')} aria-expanded={panel === 'privacy'}><span><Heart size={17} /></span><b>Privacidad y seguridad</b>{panel === 'privacy' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
    {panel === 'privacy' && <div className="setting-panel"><p>Tu diario, tus objetivos y tus aprendizajes se guardan solo en este dispositivo y navegador. Mentax no tiene cuentas ni servidores con tus datos.</p><p>Cuando envías una entrada a Mentax, respondes a sus preguntas, pides ideas o el resumen semanal, se envía a la IA solo el texto necesario para responder (la entrada, algunas entradas recientes, tus objetivos activos y tus aprendizajes guardados). No se almacena.</p><p>Si borras los datos del navegador, perderás tu diario: exporta una copia de seguridad de vez en cuando.</p></div>}
    <button className="setting-row" onClick={() => toggle('help')} aria-expanded={panel === 'help'}><span><CircleHelp size={17} /></span><b>Ayuda y soporte</b>{panel === 'help' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
    {panel === 'help' && <div className="setting-panel"><p><b>Tu diario:</b> cada día escribe libremente cómo te ha ido. Si no sabes por dónde empezar, pide una idea.</p><p><b>Mentax reflexiona contigo:</b> lee tu entrada, te da su reflexión y te hace un par de preguntas para profundizar. Cuando respondes, cierra el día con un comentario y un aprendizaje que puedes guardar.</p><p><b>Objetivos:</b> si escribes lo que quieres conseguir («esta semana quiero…»), Mentax te propone añadirlo a tus objetivos y el fin de semana te pregunta cómo ha ido.</p><p><b>Mi semana:</b> tu ánimo, tu constancia y un resumen de aprendizajes.</p><p>Mentax es una herramienta de apoyo para reflexionar; no sustituye tu criterio ni la ayuda de un profesional cuando la necesites.</p></div>}
    <button className="setting-row danger" onClick={clearEverything} onBlur={() => setConfirmClear(false)}><span><Trash2 size={17} /></span><b>{confirmClear ? 'Pulsa otra vez para borrarlo todo' : 'Borrar todos los datos'}</b><ChevronRight size={16} /></button>

    <div className="profile-footer"><Logo /><p>Mentax · Tu espacio para entenderte, crecer y avanzar.</p></div></div>
}
