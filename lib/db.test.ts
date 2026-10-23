import 'fake-indexeddb/auto'
import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Dexie from 'dexie'
import { buildBackup, parseBackup, restoreBackup } from './backup'
import { clearAll, createGoal, db, deleteEntry, entryForDay, markGoalHandled, saveAnswersAndClosing, saveEntry, saveLearning, saveMentaxReflection, updateGoal } from './db'

const text = 'He paseado por el parque. Esta semana quiero dormir mejor.'
const reflection = { title: 'Un paseo tranquilo', reflexion: 'r', preguntas: ['¿A?', '¿B?'], objetivos: ['Dormir mejor'], ayudaProfesional: null, createdAt: 1 }
const closing = { comentario: 'c', aprendizaje: 'Pasear me calma', ayudaProfesional: null, createdAt: 2 }

describe('base local', () => {
  beforeEach(() => clearAll())

  it('crea y edita una entrada acumulando tiempo', async () => {
    const id = await saveEntry({ date: '2024-05-20', text, mood: 4, durationSec: 60 })
    assert.equal((await entryForDay('2024-05-20'))?.id, id)
    await saveEntry({ date: '2024-05-20', text, mood: 5, durationSec: 30 }, id)
    const e = (await db.reflections.get(id))!
    assert.equal(e.durationSec, 90)
    assert.equal(e.mood, 5)
    assert.equal(e.title, 'He paseado por el parque')
  })

  it('la conversación se conserva si el texto no cambia y se descarta si cambia', async () => {
    const id = await saveEntry({ date: '2024-05-20', text, durationSec: 10 })
    await saveMentaxReflection(id, reflection)
    await saveAnswersAndClosing(id, ['a', 'b'], closing)
    await markGoalHandled(id, 'Dormir mejor')
    assert.equal((await db.reflections.get(id))!.title, 'Un paseo tranquilo')
    await saveEntry({ date: '2024-05-20', text, mood: 3, durationSec: 0 }, id)
    const kept = (await db.reflections.get(id))!
    assert.deepEqual(kept.answers, ['a', 'b'])
    assert.ok(kept.closing)
    await saveEntry({ date: '2024-05-20', text: 'Otra cosa distinta', durationSec: 0 }, id)
    const e = (await db.reflections.get(id))!
    assert.equal(e.reflection, undefined)
    assert.equal(e.closing, undefined)
    assert.deepEqual(e.answers, [])
    assert.deepEqual(e.handledGoals, [])
    assert.equal(e.title, 'Otra cosa distinta')
  })

  it('una reflexión nueva de Mentax reinicia respuestas y cierre', async () => {
    const id = await saveEntry({ date: '2024-05-20', text, durationSec: 10 })
    await saveMentaxReflection(id, reflection)
    await saveAnswersAndClosing(id, ['a'], closing)
    await saveMentaxReflection(id, { ...reflection, createdAt: 3 })
    const e = (await db.reflections.get(id))!
    assert.deepEqual(e.answers, [])
    assert.equal(e.closing, undefined)
  })

  it('borrar una entrada borra sus aprendizajes', async () => {
    const id = await saveEntry({ date: '2024-05-20', text, durationSec: 10 })
    await saveLearning('Pasear me calma', id)
    await saveLearning('Pasear me calma', id)
    assert.equal(await db.learnings.count(), 1)
    await deleteEntry(id)
    assert.equal(await db.learnings.count(), 0)
  })

  it('objetivos: límites de progreso y completar', async () => {
    const id = await createGoal('  Dormir mejor ', '', 140, 'entrada-1')
    const created = (await db.goals.get(id))!
    assert.equal(created.progress, 100)
    assert.equal(created.entryId, 'entrada-1')
    await updateGoal(id, { progress: 40 })
    await updateGoal(id, { status: 'completed' })
    const g = (await db.goals.get(id))!
    assert.equal(g.title, 'Dormir mejor')
    assert.equal(g.progress, 100)
    assert.ok(g.completedAt)
  })

  it('exportar y restaurar devuelve los mismos datos', async () => {
    const id = await saveEntry({ date: '2024-05-20', text, durationSec: 10 })
    await createGoal('Leer', '', 20)
    await db.settings.put({ key: 'profile', value: { name: 'Alex', tagline: 't' } })
    const backup = parseBackup(JSON.stringify(await buildBackup()))
    await clearAll()
    await restoreBackup(backup)
    assert.equal((await db.reflections.get(id))?.text, text)
    assert.equal(await db.goals.count(), 1)
    assert.deepEqual((await db.settings.get('profile'))?.value, { name: 'Alex', tagline: 't' })
  })
})

describe('actualización desde la primera versión', () => {
  it('convierte las reflexiones guiadas guardadas en entradas del diario', async () => {
    db.close()
    await Dexie.delete('mentax')
    // Base tal como la dejaba la v1.
    const v1 = new Dexie('mentax')
    v1.version(1).stores({ reflections: 'id, date, createdAt, favorite', goals: 'id, status, createdAt', learnings: 'id, createdAt, reflectionId', weekSummaries: 'weekStart', dailyQuestions: 'date', settings: 'key' })
    await v1.table('reflections').put({ id: 'old', date: '2024-05-20', mode: 'full', answers: [{ question: '¿Qué ha ido bien?', answer: 'Paseo' }], title: 'Paseo', favorite: false, durationSec: 30, createdAt: 1, updatedAt: 1 })
    v1.close()
    await db.open()
    const e = (await db.reflections.get('old'))!
    assert.equal(e.text, '¿Qué ha ido bien?\nPaseo')
    assert.deepEqual(e.answers, [])
    assert.deepEqual(e.handledGoals, [])
    assert.equal(await db.dailyIdeas.count(), 0)
  })
})
