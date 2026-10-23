import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { checkinStreak, goalStatus, guessTracking, withCheckin } from './goals'
import { migrateEntry } from './entries'
import type { Goal, GoalCheckin } from './types'

const goal = (over: Partial<Goal>): Goal => ({ id: 'g', title: 'x', description: '', progress: 0, status: 'active', tone: 'violet', createdAt: 0, updatedAt: 0, ...over })
const check = (date: string, entryId = `e-${date}`): GoalCheckin => ({ date, entryId, note: '', createdAt: 0 })

describe('cómo se mide un objetivo', () => {
  it('deduce la medida a partir del título', () => {
    assert.deepEqual(guessTracking('Hacer ejercicio cada día'), { kind: 'daily' })
    assert.deepEqual(guessTracking('Meditar todos los días'), { kind: 'daily' })
    assert.deepEqual(guessTracking('Ir 3 días al gimnasio'), { kind: 'weekly', times: 3 })
    assert.deepEqual(guessTracking('Salir a correr dos veces por semana'), { kind: 'weekly', times: 2 })
    assert.deepEqual(guessTracking('Leer 5 libros'), { kind: 'total', times: 5 })
    assert.deepEqual(guessTracking('Ir 20 veces a nadar'), { kind: 'total', times: 20 })
    assert.deepEqual(guessTracking('Ser más paciente'), { kind: 'manual' })
  })
})

describe('progreso de un objetivo', () => {
  const today = '2024-05-23' // jueves; la semana empieza el lunes 20

  it('cada día: días de esta semana y racha', () => {
    const g = goal({ tracking: { kind: 'daily' }, checkins: [check('2024-05-17'), check('2024-05-21'), check('2024-05-22'), check('2024-05-23')] })
    const s = goalStatus(g, today)
    assert.equal(s.percent, 43)
    assert.equal(s.label, '3/7 días esta semana · 3 seguidos')
  })

  it('por semana: se reinicia el lunes y avisa al cumplirlo', () => {
    const tracking = { kind: 'weekly' as const, times: 3 }
    assert.equal(goalStatus(goal({ tracking, checkins: [check('2024-05-19'), check('2024-05-21')] }), today).label, '1 de 3 esta semana')
    const full = goalStatus(goal({ tracking, checkins: [check('2024-05-20'), check('2024-05-21'), check('2024-05-23')] }), today)
    assert.equal(full.percent, 100)
    assert.match(full.label, /Cumplido/)
  })

  it('en total: suma todos los avances y marca la meta', () => {
    const s = goalStatus(goal({ tracking: { kind: 'total', times: 2 }, checkins: [check('2024-01-01'), check('2024-05-23')] }), today)
    assert.equal(s.percent, 100)
    assert.equal(s.reached, true)
  })

  it('manual: usa la barra del usuario y recuerda el último avance', () => {
    assert.equal(goalStatus(goal({ progress: 40 }), today).percent, 40)
    assert.equal(goalStatus(goal({ progress: 40, checkins: [check('2024-05-22')] }), today).label, 'Último avance: ayer')
  })

  it('un mismo día cuenta una vez por entrada', () => {
    const list = withCheckin([check('2024-05-23', 'e1')], { date: '2024-05-23', entryId: 'e1', note: 'nota nueva', createdAt: 1 })
    assert.equal(list.length, 1)
    assert.equal(list[0].note, 'nota nueva')
    assert.equal(checkinStreak(list, today), 1)
  })
})

describe('objetivos detectados antes de la v3', () => {
  it('pasan de texto a objetivo con medida', () => {
    const e = migrateEntry({ id: 'e', date: '2024-05-20', text: 't', title: 't', favorite: false, durationSec: 0, answers: [], handledGoals: [], createdAt: 1, updatedAt: 1,
      reflection: { title: '', reflexion: 'r', preguntas: [], objetivos: ['Ir 3 días al gimnasio'] as never, ayudaProfesional: null, createdAt: 1 } })
    assert.deepEqual(e.reflection?.objetivos, [{ title: 'Ir 3 días al gimnasio', tracking: { kind: 'weekly', times: 3 } }])
  })
})
