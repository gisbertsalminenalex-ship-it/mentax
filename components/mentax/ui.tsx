'use client'

import { ArrowLeft, ChevronRight, CalendarDays, Compass, FileText, Target, UserRound } from 'lucide-react'
import type { Mood } from '@/lib/types'
import type { Navigate, Screen } from './nav'

export function Logo() {
  return <div className="brand-mark"><img src="/mentax-logo.png" alt="Logo de Mentax" /></div>
}

export function Button({ children, onClick, variant = 'primary', className = '', disabled, type = 'button' }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'soft'; className?: string; disabled?: boolean; type?: 'button' | 'submit' }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`app-button ${variant} ${className}`}>{children}</button>
}

export function Header({ title, onBack, action }: { title: string; onBack?: () => void; action?: React.ReactNode }) {
  return <header className="screen-header"><button className="icon-button" onClick={onBack} aria-label="Volver"><ArrowLeft size={19} /></button><h1>{title}</h1><div className="header-action">{action}</div></header>
}

const navItems: { id: Screen; label: string; icon: typeof Compass }[] = [
  { id: 'home', label: 'Inicio', icon: Compass },
  { id: 'reflections', label: 'Reflexiones', icon: FileText },
  { id: 'week', label: 'Semana', icon: CalendarDays },
  { id: 'goals', label: 'Objetivos', icon: Target },
  { id: 'profile', label: 'Perfil', icon: UserRound },
]

export const TAB_SCREENS: Screen[] = navItems.map((n) => n.id)

export function BottomNav({ active, navigate }: { active: Screen; navigate: Navigate }) {
  return <nav className="bottom-nav" aria-label="Navegación principal">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={18} /><span>{label}</span></button>)}</nav>
}

export function ActionRow({ icon, tone, title, subtitle, onClick }: { icon: React.ReactNode; tone: string; title: string; subtitle: string; onClick: () => void }) {
  return <button className="action-row" onClick={onClick}><span className={`action-icon ${tone}`}>{icon}</span><span className="action-copy"><b>{title}</b><small>{subtitle}</small></span><ChevronRight size={17} /></button>
}

export const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Mal' },
  { value: 2, emoji: '🙁', label: 'Regular' },
  { value: 3, emoji: '😐', label: 'Normal' },
  { value: 4, emoji: '🙂', label: 'Bien' },
  { value: 5, emoji: '😄', label: 'Muy bien' },
]

export const moodOf = (value?: Mood) => MOODS.find((m) => m.value === value)

export function MoodPicker({ value, onChange }: { value?: Mood; onChange: (mood: Mood) => void }) {
  return <div className="mood-picker"><b>¿Cómo te sientes en general hoy?</b><div>{MOODS.map((m) => <button type="button" key={m.value} className={value === m.value ? 'selected' : ''} onClick={() => onChange(m.value)} aria-pressed={value === m.value}><span>{m.emoji}</span><small>{m.label}</small></button>)}</div></div>
}

export function Loading({ text }: { text: string }) {
  return <div className="loading-state"><span className="spinner" />{text}</div>
}
