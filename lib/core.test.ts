import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, currentStreak, dayKey, formatLong, weekDays, weekStart } from './dates'
import { deriveTitle, localQuestionsFor, OBJECTIVES } from './questions'
import { cleanAnalysis, cleanQuestions, cleanWeek, parseAIRequest } from './ai/contract'
import { parseBackup } from './backup'
import { parseJSONOutput, readCloudflareConfig } from './ai/cloudflare'
import { analysisPrompt } from './ai/prompts'

describe('fechas', () => {
  it('dayKey usa la fecha local', () => {
    assert.equal(dayKey(new Date(2024, 4, 21, 23, 59)), '2024-05-21')
  })
  it('addDays cruza meses y años', () => {
    assert.equal(addDays('2024-02-28', 2), '2024-03-01')
    assert.equal(addDays('2024-01-01', -1), '2023-12-31')
  })
  it('las semanas empiezan en lunes', () => {
    assert.equal(weekStart('2024-05-21'), '2024-05-20') // martes
    assert.equal(weekStart('2024-05-26'), '2024-05-20') // domingo
    assert.equal(weekStart('2024-05-20'), '2024-05-20') // lunes
    assert.deepEqual(weekDays('2024-05-20').at(-1), '2024-05-26')
  })
  it('formatLong en español', () => {
    assert.equal(formatLong('2024-05-20'), 'Lunes, 20 de mayo de 2024')
  })
})

describe('racha', () => {
  it('cuenta días seguidos hasta hoy', () => {
    assert.equal(currentStreak(['2024-05-19', '2024-05-20', '2024-05-21'], '2024-05-21'), 3)
  })
  it('sigue viva desde ayer si hoy aún no hay reflexión', () => {
    assert.equal(currentStreak(['2024-05-19', '2024-05-20'], '2024-05-21'), 2)
  })
  it('se rompe con un día sin reflexión', () => {
    assert.equal(currentStreak(['2024-05-18', '2024-05-21'], '2024-05-21'), 1)
    assert.equal(currentStreak(['2024-05-18'], '2024-05-21'), 0)
  })
  it('varias reflexiones el mismo día cuentan una vez', () => {
    assert.equal(currentStreak(['2024-05-21', '2024-05-21'], '2024-05-21'), 1)
  })
})

describe('preguntas locales', () => {
  it('siempre una por objetivo y en orden', () => {
    for (let i = 0; i < 20; i++) {
      assert.deepEqual(localQuestionsFor(addDays('2024-05-01', i)).map((q) => q.objective), OBJECTIVES)
    }
  })
  it('rotan de un día a otro', () => {
    assert.notDeepEqual(localQuestionsFor('2024-05-20').map((q) => q.text), localQuestionsFor('2024-05-21').map((q) => q.text))
  })
  it('deriveTitle resume la primera respuesta', () => {
    assert.equal(deriveTitle([{ question: 'q', answer: '' }, { question: 'q', answer: 'he quedado con amigos. Luego cené.' }]), 'He quedado con amigos')
    assert.equal(deriveTitle([{ question: 'q', answer: 'uno dos tres cuatro cinco seis siete ocho nueve' }]), 'Uno dos tres cuatro cinco seis siete…')
    assert.equal(deriveTitle([]), 'Reflexión')
  })
})

describe('contrato IA', () => {
  const memory = { goals: [{ title: 'Dormir mejor', progress: 30 }], learnings: ['Me siento mejor cuando paseo'] }
  const reflection = { date: '2024-05-20', mood: 4 as const, answers: [{ question: '¿Qué ha ido bien?', answer: 'Paseo' }] }

  it('acepta peticiones bien formadas y rechaza las demás', () => {
    assert.ok(parseAIRequest({ task: 'questions', input: { today: '2024-05-21', recent: [reflection], ...memory } }))
    assert.ok(parseAIRequest({ task: 'analysis', input: { reflection, recent: [], ...memory } }))
    assert.ok(parseAIRequest({ task: 'week', input: { weekStart: '2024-05-20', reflections: [reflection], ...memory } }))
    assert.equal(parseAIRequest({ task: 'week', input: { weekStart: '2024-05-20', reflections: [], ...memory } }), null)
    assert.equal(parseAIRequest({ task: 'otra', input: memory }), null)
    assert.equal(parseAIRequest({ task: 'analysis', input: { reflection: { date: 1 }, recent: [], ...memory } }), null)
    assert.equal(parseAIRequest('hola'), null)
  })

  it('cleanQuestions exige los tres objetivos y los ordena', () => {
    const raw = { questions: [
      { objective: 'interior', text: '¿Qué sentiste?', help: 'h', hints: ['a', 'b', 'c', 'd'] },
      { objective: 'bien', text: '¿Qué fue bien?', help: 'h', hints: [] },
      { objective: 'dificultad', text: '¿Qué costó?', help: 'h', hints: ['x'] },
    ] }
    const clean = cleanQuestions(raw)!
    assert.deepEqual(clean.map((q) => q.objective), OBJECTIVES)
    assert.equal(clean[2].hints.length, 3)
    assert.equal(cleanQuestions({ questions: raw.questions.slice(1) }), null)
    assert.equal(cleanQuestions(null), null)
  })

  it('cleanAnalysis convierte la ayuda vacía en null', () => {
    const a = cleanAnalysis({ title: 'Un buen día.', respuesta: 'Te leo.', observacion: 'o', aprendizaje: 'a', sugerencia: 's', ayudaProfesional: '  ' }, 1)!
    assert.equal(a.ayudaProfesional, null)
    assert.equal(a.title, 'Un buen día')
    assert.equal(cleanAnalysis({ title: 'x' }), null)
    const serious = cleanAnalysis({ respuesta: 'r', ayudaProfesional: 'Habla con un profesional.' })!
    assert.equal(serious.ayudaProfesional, 'Habla con un profesional.')
  })

  it('cleanWeek limita listas', () => {
    const w = cleanWeek({ resumen: 'r', aprendizajes: ['1', '2', '3', '4', '5'], areas: ['a', 2, 'b'] })!
    assert.equal(w.aprendizajes.length, 4)
    assert.deepEqual(w.areas, ['a', 'b'])
    assert.equal(cleanWeek({ resumen: '', aprendizajes: [] }), null)
  })

  it('el prompt de análisis encierra lo escrito por el usuario en <datos>', () => {
    const p = analysisPrompt({ reflection, recent: [], ...memory })
    assert.match(p.user, /<datos>[\s\S]*Paseo[\s\S]*<\/datos>/)
    assert.match(p.system, /ayudaProfesional/)
  })

  it('parseJSONOutput tolera bloques ```json', () => {
    assert.deepEqual(parseJSONOutput('```json\n{"a":1}\n```'), { a: 1 })
  })

  it('sin credenciales no hay configuración', () => {
    assert.equal(readCloudflareConfig({}), null)
    assert.equal(readCloudflareConfig({ CF_ACCOUNT_ID: 'a', CF_API_TOKEN: 't' })?.model, '@cf/google/gemma-4-26b-a4b-it')
  })
})

describe('copia de seguridad', () => {
  const valid = { app: 'mentax', version: 1, exportedAt: '2024-05-21T00:00:00Z', data: { profile: null, reflections: [{ id: 'r', date: '2024-05-20', answers: [] }], goals: [{ id: 'g', title: 'x' }], learnings: [], weekSummaries: [] } }
  it('acepta una copia válida', () => {
    assert.equal(parseBackup(JSON.stringify(valid)).data.reflections.length, 1)
  })
  it('rechaza archivos que no son de Mentax o están dañados', () => {
    assert.throws(() => parseBackup('no json'), /no es una copia/)
    assert.throws(() => parseBackup(JSON.stringify({ ...valid, app: 'otra' })), /Mentax/)
    assert.throws(() => parseBackup(JSON.stringify({ ...valid, version: 99 })), /más nueva/)
    assert.throws(() => parseBackup(JSON.stringify({ ...valid, data: { ...valid.data, goals: 'x' } })), /dañada/)
  })
})
