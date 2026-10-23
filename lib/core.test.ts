import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { addDays, currentStreak, dayKey, formatLong, weekDays, weekStart } from './dates'
import { deriveTitle, localIdeasFor, migrateEntry, stageOf } from './entries'
import { cleanClosing, cleanIdeas, cleanReflection, cleanWeek, parseAIRequest } from './ai/contract'
import { parseBackup } from './backup'
import { parseJSONOutput, readCloudflareConfig } from './ai/cloudflare'
import { closePrompt, reflectPrompt } from './ai/prompts'

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
  it('sigue viva desde ayer si hoy aún no hay entrada', () => {
    assert.equal(currentStreak(['2024-05-19', '2024-05-20'], '2024-05-21'), 2)
  })
  it('se rompe con un día sin entrada', () => {
    assert.equal(currentStreak(['2024-05-18', '2024-05-21'], '2024-05-21'), 1)
    assert.equal(currentStreak(['2024-05-18'], '2024-05-21'), 0)
  })
})

describe('entradas del diario', () => {
  it('deriveTitle resume la primera frase', () => {
    assert.equal(deriveTitle('hoy he quedado con amigos. Luego cené.'), 'Hoy he quedado con amigos')
    assert.equal(deriveTitle('Lunes de trabajo\nMucho lío'), 'Lunes de trabajo')
    assert.equal(deriveTitle('uno dos tres cuatro cinco seis siete ocho nueve'), 'Uno dos tres cuatro cinco seis siete…')
    assert.equal(deriveTitle('  '), 'Entrada del diario')
  })
  it('las ideas locales son tres, distintas y rotan cada día', () => {
    const a = localIdeasFor('2024-05-20')
    assert.equal(new Set(a).size, 3)
    assert.notDeepEqual(a, localIdeasFor('2024-05-21'))
  })
  it('stageOf sigue la conversación', () => {
    const reflection = { title: '', reflexion: 'r', preguntas: ['p'], objetivos: [], ayudaProfesional: null, createdAt: 1 }
    assert.equal(stageOf({}), 'written')
    assert.equal(stageOf({ reflection }), 'questions')
    assert.equal(stageOf({ reflection, closing: { comentario: 'c', aprendizaje: 'a', ayudaProfesional: null, createdAt: 1 } }), 'closed')
  })
  it('migra las reflexiones guiadas de la primera versión', () => {
    const e = migrateEntry({
      id: 'r1', date: '2024-05-20', mode: 'full', mood: 4, title: 'Un buen día', favorite: true, durationSec: 120,
      answers: [{ question: '¿Qué ha ido bien?', answer: 'Paseo' }, { question: '¿Dificultades?', answer: '' }],
      analysis: { title: 'Un buen día', respuesta: 'Te leo', observacion: 'Obs.', aprendizaje: 'Pasear me calma', sugerencia: 'Sug.', ayudaProfesional: null, createdAt: 5 },
      createdAt: 1, updatedAt: 2,
    })
    assert.equal(e.text, '¿Qué ha ido bien?\nPaseo')
    assert.equal(e.reflection?.reflexion, 'Te leo')
    assert.deepEqual(e.reflection?.preguntas, [])
    assert.equal(e.closing?.comentario, 'Obs. Sug.')
    assert.equal(e.closing?.aprendizaje, 'Pasear me calma')
    assert.equal(stageOf(e), 'closed')
    assert.equal(e.favorite, true)
    assert.deepEqual(e.handledGoals, [])
  })
  it('las entradas nuevas pasan sin cambios', () => {
    const entry = { id: 'e', date: '2024-05-20', text: 'Hola', title: 'Hola', favorite: false, durationSec: 0, answers: ['x'], handledGoals: ['y'], createdAt: 1, updatedAt: 1 }
    assert.deepEqual(migrateEntry(entry), entry)
  })
})

describe('contrato IA', () => {
  const memory = { goals: [{ ref: 'g1', title: 'Dormir mejor', progress: 30, thisWeek: true, seguimiento: 'cada día' }], learnings: ['Me siento mejor cuando paseo'] }
  const entry = { date: '2024-05-20', mood: 4 as const, text: 'Hoy he paseado. Esta semana quiero ir 3 días al gimnasio.' }
  const qa = [{ pregunta: '¿Qué te dio el paseo?', respuesta: 'Calma' }]

  it('acepta peticiones bien formadas y rechaza las demás', () => {
    assert.ok(parseAIRequest({ task: 'reflect', input: { weekday: 'lunes', entry, recent: [], ...memory } }))
    assert.ok(parseAIRequest({ task: 'close', input: { entry, reflexion: 'r', qa, ...memory } }))
    assert.ok(parseAIRequest({ task: 'ideas', input: { today: '2024-05-21', recent: [entry], ...memory } }))
    assert.ok(parseAIRequest({ task: 'week', input: { weekStart: '2024-05-20', entries: [entry], ...memory } }))
    assert.equal(parseAIRequest({ task: 'reflect', input: { weekday: 'lunes', entry: { ...entry, text: '  ' }, recent: [], ...memory } }), null)
    assert.equal(parseAIRequest({ task: 'close', input: { entry, reflexion: 'r', qa: [], ...memory } }), null)
    assert.equal(parseAIRequest({ task: 'week', input: { weekStart: '2024-05-20', entries: [], ...memory } }), null)
    assert.equal(parseAIRequest({ task: 'questions', input: memory }), null)
    assert.equal(parseAIRequest('hola'), null)
  })

  it('cleanReflection exige reflexión y preguntas, y deja la ayuda vacía en null', () => {
    const r = cleanReflection({
      title: 'Paseo y planes.', reflexion: 'Te leo.', preguntas: ['¿A?', '¿B?', '¿C?', '¿D?'], ayudaProfesional: '',
      objetivos: [
        { titulo: 'Ir al gimnasio 3 días por semana', frecuencia: 'semanal', veces: 3 },
        { titulo: 'ir al gimnasio 3 días por semana', frecuencia: 'semanal', veces: 3 },
        { titulo: 'Hacer ejercicio cada día', frecuencia: 'diaria', veces: 1 },
        { titulo: 'Leer 5 libros', frecuencia: 'total', veces: 5 },
        { titulo: 'Ser más paciente', frecuencia: 'ninguna', veces: 1 },
        { titulo: 'Correr', frecuencia: 'semanal', veces: 40 },
      ],
      avances: [{ ref: 'g1', nota: 'Ha corrido' }, { ref: 'g1', nota: 'repetido' }, { ref: 'x; drop', nota: 'mal' }],
    }, 1)!
    assert.equal(r.title, 'Paseo y planes')
    assert.equal(r.preguntas.length, 3)
    assert.deepEqual(r.objetivos.map((g) => g.tracking), [{ kind: 'weekly', times: 3 }, { kind: 'daily' }, { kind: 'total', times: 5 }, { kind: 'manual' }, { kind: 'weekly', times: 7 }])
    assert.deepEqual(r.avances, [{ ref: 'g1', nota: 'Ha corrido' }])
    assert.equal(r.ayudaProfesional, null)
    assert.equal(cleanReflection({ reflexion: 'x', preguntas: [] }), null)
    assert.equal(cleanReflection({ preguntas: ['¿A?'] }), null)
  })

  it('cleanClosing y cleanIdeas', () => {
    const c = cleanClosing({ comentario: 'Bien.', aprendizaje: 'a', ayudaProfesional: 'Habla con alguien.', avances: [{ ref: 'g2', nota: 'Ha leído' }] })!
    assert.equal(c.ayudaProfesional, 'Habla con alguien.')
    assert.deepEqual(c.avances, [{ ref: 'g2', nota: 'Ha leído' }])
    assert.deepEqual(cleanClosing({ comentario: 'Bien.' })!.avances, [])
    assert.equal(cleanClosing({ aprendizaje: 'a' }), null)
    assert.deepEqual(cleanIdeas({ ideas: ['a', 'b', 'c', 'd'] }), ['a', 'b', 'c'])
    assert.equal(cleanIdeas({ ideas: [] }), null)
  })

  it('cleanWeek limita listas', () => {
    const w = cleanWeek({ resumen: 'r', aprendizajes: ['1', '2', '3', '4', '5'], areas: ['a', 2, 'b'] })!
    assert.equal(w.aprendizajes.length, 4)
    assert.deepEqual(w.areas, ['a', 'b'])
    assert.equal(cleanWeek({ resumen: '', aprendizajes: [] }), null)
  })

  it('los prompts encierran lo escrito por el usuario en <datos>', () => {
    const p = reflectPrompt({ weekday: 'domingo', entry, recent: [], ...memory })
    assert.match(p.user, /<datos>[\s\S]*gimnasio[\s\S]*<\/datos>/)
    assert.match(p.user, /propuesto esta semana/)
    assert.match(p.system, /ayudaProfesional/)
    assert.match(closePrompt({ entry, reflexion: 'r', qa, ...memory }).user, /<datos>[\s\S]*Calma[\s\S]*<\/datos>/)
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
  const valid = { app: 'mentax', version: 2, exportedAt: '2024-05-21T00:00:00Z', data: { profile: null, reflections: [{ id: 'r', date: '2024-05-20', text: 'hola' }], goals: [{ id: 'g', title: 'x' }], learnings: [], weekSummaries: [] } }
  it('acepta copias de esta versión y de la primera', () => {
    assert.equal(parseBackup(JSON.stringify(valid)).data.reflections.length, 1)
    assert.ok(parseBackup(JSON.stringify({ ...valid, version: 1, data: { ...valid.data, reflections: [{ id: 'r', date: '2024-05-20', answers: [] }] } })))
  })
  it('rechaza archivos que no son de Mentax o están dañados', () => {
    assert.throws(() => parseBackup('no json'), /no es una copia/)
    assert.throws(() => parseBackup(JSON.stringify({ ...valid, app: 'otra' })), /Mentax/)
    assert.throws(() => parseBackup(JSON.stringify({ ...valid, version: 99 })), /más nueva/)
    assert.throws(() => parseBackup(JSON.stringify({ ...valid, data: { ...valid.data, goals: 'x' } })), /dañada/)
  })
})
