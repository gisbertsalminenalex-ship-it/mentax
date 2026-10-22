/**
 * Cloudflare Workers AI (endpoint compatible con OpenAI), solo en el servidor.
 * Credenciales: `CF_ACCOUNT_ID` + `CF_API_TOKEN`; modelo opcional en `CF_AI_MODEL`.
 */
import type { PromptSpec } from './prompts'

export const CLOUDFLARE_DEFAULT_MODEL = '@cf/google/gemma-4-26b-a4b-it'

export interface CloudflareConfig {
  accountId: string
  apiToken: string
  model: string
}

export function readCloudflareConfig(env: Record<string, string | undefined> = process.env): CloudflareConfig | null {
  const accountId = env.CF_ACCOUNT_ID?.trim()
  const apiToken = env.CF_API_TOKEN?.trim()
  if (!accountId || !apiToken) return null
  return { accountId, apiToken, model: env.CF_AI_MODEL?.trim() || CLOUDFLARE_DEFAULT_MODEL }
}

export class AICallError extends Error {
  constructor(
    readonly kind: 'rate-limit' | 'failed',
    message: string,
  ) {
    super(message)
  }
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>
}

export function parseJSONOutput(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    // Algunos modelos envuelven el JSON en ```json … ```.
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (m) return JSON.parse(m[1])
    throw new Error('la respuesta no es JSON')
  }
}

export async function runCloudflare(config: CloudflareConfig, spec: PromptSpec, fetchImpl: typeof fetch = fetch, timeoutMs = 30_000): Promise<unknown> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(config.accountId)}/ai/v1/chat/completions`
  const body = {
    model: config.model,
    temperature: 0.6,
    max_completion_tokens: spec.maxOutputTokens,
    messages: [
      { role: 'system', content: spec.system },
      { role: 'user', content: spec.user },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'mentax_output', strict: true, schema: spec.schema } },
    chat_template_kwargs: { enable_thinking: false },
  }
  let res: Response
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiToken}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch {
    throw new AICallError('failed', 'Cloudflare: error de red o tiempo agotado')
  }
  if (res.status === 429) throw new AICallError('rate-limit', 'Cloudflare: HTTP 429')
  if (!res.ok) throw new AICallError('failed', `Cloudflare: HTTP ${res.status}`)
  const data = (await res.json().catch(() => null)) as ChatResponse | null
  const choice = data?.choices?.[0]
  if (choice?.finish_reason === 'length') throw new AICallError('failed', 'Cloudflare: respuesta truncada')
  const text = choice?.message?.content ?? ''
  if (!text) throw new AICallError('failed', 'Cloudflare: respuesta vacía')
  try {
    return parseJSONOutput(text)
  } catch {
    throw new AICallError('failed', 'Cloudflare: la respuesta no es JSON')
  }
}
