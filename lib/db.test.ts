import 'fake-indexeddb/auto'
import { beforeEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildBackup, parseBackup, restoreBackup } from './backup'
import { clearAll, createGoal, db, deleteReflection, reflectionForDay, saveAnalysis, saveLearning, saveReflection, updateGoal } from './db'

const answers = [{ question: '¿Qué ha ido bien?', answer: 'He paseado por el parque.' }]
const analysis = { title: 'Un paseo tranquilo', respuesta: 'r', observacion: 'o', aprendizaje: 'Pasear me calma', sugerencia: 's', ayudaProfesional: null, createdAt: 1 }

describe('base local', () => {
  beforeEach(() => clearAll())

  it('crea y edita una reflexión acumulando tiempo', async () => {
    const id = await saveReflection({ date: '2024-05-20', mode: 'full', answers, mood: 4, durationSec: 60 })
    assert.equal((await reflectionForDay('2024-05-20'))?.id, id)
    await saveReflection({ date: '2024-05-20', mode: 'full', answers, mood: 5, durationSec: 30 }, id)
    const r = (await db.reflections.get(id))!
    assert.equal(r.durationSec, 90)
    assert.equal(r.mood, 5)
    assert.equal(r.title, 'He paseado por el parque')
  })

  it('el análisis se conserva si el texto no cambia y se descarta si cambia', async () => {
    const id = await saveReflection({ date: '2024-05-20', mode: 'full', answers, durationSec: 10 })
    await saveAnalysis(id, analysis)
    assert.equal((await db.reflections.get(id))!.title, 'Un paseo tranquilo')
    await saveReflection({ date: '2024-05-20', mode: 'full', answers, mood: 3, durationSec: 0 }, id)
    assert.ok((await db.reflections.get(id))!.analysis)
    await saveReflection({ date: '2024-05-20', mode: 'full', answers: [{ ...answers[0], answer: 'Otra cosa distinta' }], durationSec: 0 }, id)
    const r = (await db.reflections.get(id))!
    assert.equal(r.analysis, undefined)
    assert.equal(r.title, 'Otra cosa distinta')
  })

  it('borrar una reflexión borra sus aprendizajes', async () => {
    const id = await saveReflection({ date: '2024-05-20', mode: 'full', answers, durationSec: 10 })
    await saveLearning('Pasear me calma', id)
    await saveLearning('Pasear me calma', id)
    assert.equal(await db.learnings.count(), 1)
    await deleteReflection(id)
    assert.equal(await db.learnings.count(), 0)
  })

  it('completar un objetivo lo pone al 100 %', async () => {
    const id = await createGoal('  Dormir mejor ', '', 140)
    assert.equal((await db.goals.get(id))!.progress, 100)
    await updateGoal(id, { progress: 40 })
    await updateGoal(id, { status: 'completed' })
    const g = (await db.goals.get(id))!
    assert.equal(g.title, 'Dormir mejor')
    assert.equal(g.progress, 100)
    assert.ok(g.completedAt)
  })

  it('exportar y restaurar devuelve los mismos datos', async () => {
    const id = await saveReflection({ date: '2024-05-20', mode: 'brief', answers, durationSec: 10 })
    await createGoal('Leer', '', 20)
    await db.settings.put({ key: 'profile', value: { name: 'Alex', tagline: 't' } })
    const backup = parseBackup(JSON.stringify(await buildBackup()))
    await clearAll()
    await restoreBackup(backup)
    assert.equal((await db.reflections.get(id))?.mode, 'brief')
    assert.equal(await db.goals.count(), 1)
    assert.deepEqual((await db.settings.get('profile'))?.value, { name: 'Alex', tagline: 't' })
  })
})
