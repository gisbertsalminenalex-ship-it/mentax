/**
 * POST /api/ai — único punto de contacto con la IA. Recibe el contexto mínimo
 * de una tarea, llama a Cloudflare y devuelve la salida ya limpia. No guarda nada.
 */
import { NextResponse } from 'next/server'
import { cleanAnalysis, cleanQuestions, cleanWeek, MAX_BODY_BYTES, parseAIRequest, type AIErrorCode, type AIResponse } from '@/lib/ai/contract'
import { AICallError, readCloudflareConfig, runCloudflare } from '@/lib/ai/cloudflare'
import { analysisPrompt, questionsPrompt, weekPrompt } from '@/lib/ai/prompts'

export const runtime = 'nodejs'
export const maxDuration = 60

// Límite sencillo por IP y por instancia, para frenar abusos de la clave.
const WINDOW_MS = 10 * 60_000
const MAX_REQUESTS = 40
const hits = new Map<string, number[]>()

function limited(ip: string, now: number): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > MAX_REQUESTS
}

const fail = (error: AIErrorCode, status: number) => NextResponse.json<AIResponse<never>>({ ok: false, error }, { status })

export async function POST(request: Request) {
  const config = readCloudflareConfig()
  if (!config) return fail('not-configured', 503)

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local'
  if (limited(ip, Date.now())) return fail('rate-limit', 429)

  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) return fail('bad-request', 413)
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return fail('bad-request', 400)
  }
  const body = parseAIRequest(raw)
  if (!body) return fail('bad-request', 400)

  try {
    let data: unknown
    if (body.task === 'questions') data = cleanQuestions(await runCloudflare(config, questionsPrompt(body.input)))
    else if (body.task === 'analysis') data = cleanAnalysis(await runCloudflare(config, analysisPrompt(body.input)))
    else data = cleanWeek(await runCloudflare(config, weekPrompt(body.input)))
    if (!data) return fail('failed', 502)
    return NextResponse.json<AIResponse<unknown>>({ ok: true, data })
  } catch (error) {
    if (error instanceof AICallError) {
      console.error(`[mentax/ai] ${body.task}: ${error.message}`)
      return fail(error.kind, error.kind === 'rate-limit' ? 429 : 502)
    }
    console.error(`[mentax/ai] ${body.task}: error inesperado`)
    return fail('failed', 500)
  }
}
