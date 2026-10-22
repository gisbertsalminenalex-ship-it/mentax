/**
 * Banco local de preguntas. Cada día se pregunta por los mismos tres
 * objetivos (lo que fue bien, las dificultades, lo que pasó por dentro),
 * pero con otra forma. Se usa cuando la IA no está disponible.
 */
import { parseDayKey } from './dates'
import type { Answer, DailyQuestion, DayKey, QuestionObjective, Reflection } from './types'

export const OBJECTIVES: QuestionObjective[] = ['bien', 'dificultad', 'interior']

export const OBJECTIVE_LABEL: Record<QuestionObjective, string> = {
  bien: 'Lo que ha ido bien',
  dificultad: 'Las dificultades',
  interior: 'Emociones y aprendizajes',
}

const BANK: Record<QuestionObjective, DailyQuestion[]> = {
  bien: [
    { objective: 'bien', text: '¿Qué ha ido bien hoy?', help: 'Piensa en los momentos, logros o cosas que te han hecho sentir bien.', hints: ['¿De qué te sientes orgulloso?', '¿Qué momento has disfrutado?', '¿Qué agradeces de tu día?'] },
    { objective: 'bien', text: '¿Qué momento de hoy te gustaría recordar?', help: 'No hace falta que sea grande: a veces lo pequeño es lo que más cuenta.', hints: ['¿Con quién estabas?', '¿Qué lo hizo especial?', '¿Cómo te sentiste en ese momento?'] },
    { objective: 'bien', text: '¿Qué has hecho hoy que te acerque a quien quieres ser?', help: 'Cualquier paso cuenta, aunque parezca pequeño.', hints: ['¿Qué decisión tomaste bien?', '¿Qué hábito mantuviste?', '¿A quién ayudaste?'] },
    { objective: 'bien', text: '¿Por qué tres cosas te sientes agradecido hoy?', help: 'Fíjate en personas, situaciones o detalles que te hicieron bien.', hints: ['¿Alguien tuvo un gesto contigo?', '¿Qué fue más fácil de lo esperado?', '¿Qué das por hecho y valoras?'] },
    { objective: 'bien', text: '¿Qué te ha dado energía hoy?', help: 'Observa qué actividades, personas o lugares te recargaron.', hints: ['¿Cuándo te sentiste con más ganas?', '¿Qué te hizo sonreír?', '¿Qué te gustaría repetir mañana?'] },
  ],
  dificultad: [
    { objective: 'dificultad', text: '¿Qué dificultades has tenido?', help: 'Observa los retos del día con curiosidad y amabilidad.', hints: ['¿Qué te costó más de lo esperado?', '¿Qué te frenó?', '¿Cómo reaccionaste?'] },
    { objective: 'dificultad', text: '¿Qué te ha resultado difícil hoy y por qué?', help: 'Intenta entender qué había detrás, sin juzgarte.', hints: ['¿Qué estaba en tu mano y qué no?', '¿Te había pasado antes?', '¿Qué necesitabas en ese momento?'] },
    { objective: 'dificultad', text: '¿Hubo algo que te gustaría haber hecho de otra forma?', help: 'Mirarlo con calma te ayuda a decidir mejor la próxima vez.', hints: ['¿Qué harías distinto?', '¿Qué te impidió hacerlo así?', '¿Qué aprendes de ello?'] },
    { objective: 'dificultad', text: '¿Qué te ha quitado energía hoy?', help: 'Detecta lo que te desgasta para poder cuidarte mejor.', hints: ['¿Fue una persona, una tarea o un pensamiento?', '¿Cuándo empezaste a notarlo?', '¿Qué podrías cambiar?'] },
    { objective: 'dificultad', text: '¿Qué reto tienes ahora mismo entre manos?', help: 'Ponerle nombre es el primer paso para afrontarlo.', hints: ['¿Qué parte te preocupa más?', '¿Qué apoyo tienes?', '¿Cuál sería un primer paso pequeño?'] },
  ],
  interior: [
    { objective: 'interior', text: '¿Qué has sentido y qué pensamientos has tenido?', help: 'Pon nombre a lo que ha estado presente hoy.', hints: ['¿Qué emoción ha predominado?', '¿Qué pensamiento se repitió?', '¿Dónde lo notabas en el cuerpo?'] },
    { objective: 'interior', text: '¿Qué has aprendido hoy sobre ti?', help: 'Cada día deja alguna pista sobre cómo eres y cómo funcionas.', hints: ['¿Te sorprendió alguna reacción tuya?', '¿Qué necesitas más a menudo?', '¿Qué te funciona?'] },
    { objective: 'interior', text: '¿Cómo te has tratado hoy a ti mismo?', help: 'Fíjate en cómo te hablas por dentro, en lo bueno y en lo difícil.', hints: ['¿Te exigiste demasiado?', '¿Fuiste comprensivo contigo?', '¿Qué te dirías ahora?'] },
    { objective: 'interior', text: '¿Qué emoción te ha acompañado más hoy y qué te quería decir?', help: 'Las emociones suelen señalar algo que te importa.', hints: ['¿Cuándo apareció?', '¿Qué la provocó?', '¿Qué necesitaba de ti?'] },
    { objective: 'interior', text: 'Si pudieras quedarte con una idea de hoy, ¿cuál sería?', help: 'Resume en pocas palabras lo más importante que te llevas.', hints: ['¿Qué quieres recordar mañana?', '¿Qué harás diferente?', '¿Qué confirmas de ti?'] },
  ],
}

export const BRIEF_QUESTIONS = ['¿Cómo ha sido tu día en general?', '¿Qué es lo más importante que quieres recordar?', '¿Qué harás mañana para mejorar?']

/** Número de día desde una época fija, para rotar de forma estable. */
function dayIndex(date: DayKey): number {
  return Math.floor(parseDayKey(date).getTime() / 86_400_000)
}

/** Las tres preguntas locales del día: rotan cada día y no repiten combinación seguida. */
export function localQuestionsFor(date: DayKey): DailyQuestion[] {
  const n = dayIndex(date)
  return OBJECTIVES.map((objective, i) => {
    const options = BANK[objective]
    return options[(n + i * 2) % options.length]
  })
}

/** Título breve a partir de lo escrito, cuando la IA no ha puesto uno. */
export function deriveTitle(answers: Answer[]): string {
  const first = answers.find((a) => a.answer.trim())?.answer.trim() ?? ''
  if (!first) return 'Reflexión'
  const sentence = first.split(/(?<=[.!?])\s/)[0].replace(/[.!?]+$/, '')
  const words = sentence.split(/\s+/)
  const title = words.length > 7 ? `${words.slice(0, 7).join(' ')}…` : sentence
  return title.charAt(0).toUpperCase() + title.slice(1)
}

export function previewOf(reflection: Reflection): string {
  return reflection.answers.find((a) => a.answer.trim())?.answer.trim() ?? ''
}
