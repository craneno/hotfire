import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ApiError as GoogleApiError, FinishReason, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";

/**
 * Provider-agnostic structured call. Pick the provider with AI_PROVIDER in .env:
 *   google    (default) Gemini, model from GEMINI_MODEL (default gemini-4-neon), key GEMINI_API_KEY
 *   anthropic           Claude, model from CLAUDE_MODEL (default claude-opus-5-5), key ANTHROPIC_API_KEY
 */
export type Provider = "google" | "anthropic";
export type Effort = "low" | "medium" | "high";

export class AiError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export function aiConfig(): { provider: Provider; model: string; configured: boolean } {
  const provider: Provider = process.env.AI_PROVIDER === "anthropic" ? "anthropic" : "google";
  if (provider === "google")
    return {
      provider,
      model: process.env.GEMINI_MODEL ?? "gemini-4-neon",
      configured: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    };
  return {
    provider,
    model: process.env.CLAUDE_MODEL ?? process.env.HOTFIRE_MODEL ?? "claude-opus-5-5",
    configured: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE),
  };
}

export async function structured<T>(opts: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  effort: Effort;
}): Promise<T> {
  const { provider, model } = aiConfig();
  return provider === "google" ? callGoogle(model, opts) : callAnthropic(model, opts);
}

/* ---------------- Google (Gemini) ---------------- */

let google: GoogleGenAI | null = null;

const THINKING: Record<Effort, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

async function callGoogle<T>(
  model: string,
  opts: { system: string; user: string; schema: z.ZodType<T>; effort: Effort },
): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new AiError("Gemini API key missing. Set GEMINI_API_KEY in .env.", 401);
  google ??= new GoogleGenAI({ apiKey });

  const { $schema: _drop, ...jsonSchema } = z.toJSONSchema(opts.schema) as Record<string, unknown>;

  let res;
  try {
    res = await google.models.generateContent({
      model,
      contents: opts.user,
      config: {
        systemInstruction: opts.system,
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
        thinkingConfig: { thinkingLevel: THINKING[opts.effort] },
        maxOutputTokens: 32768,
      },
    });
  } catch (e) {
    if (e instanceof GoogleApiError) {
      // Google reports a bad key as 400 INVALID_ARGUMENT, not 401.
      if (e.status === 401 || e.status === 403 || /API key not valid/i.test(e.message))
        throw new AiError("Gemini API key missing or invalid. Check GEMINI_API_KEY in .env.", 401);
      if (e.status === 429) throw new AiError("Rate limited by the Gemini API. Retry shortly.", 429);
      throw new AiError(`Gemini API error ${e.status}: ${e.message}`);
    }
    throw e;
  }

  if (res.promptFeedback?.blockReason)
    throw new AiError(`Gemini blocked the request (${res.promptFeedback.blockReason}).`, 422);
  const finish = res.candidates?.[0]?.finishReason;
  if (finish === FinishReason.MAX_TOKENS) throw new AiError("Response was cut off (max tokens). Try fewer questions.");
  if (finish && finish !== FinishReason.STOP) throw new AiError(`Gemini stopped early (${finish}).`, 422);

  const text = res.text;
  if (!text) throw new AiError("Gemini returned an empty response.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AiError("Gemini returned invalid JSON.");
  }
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) throw new AiError("Gemini output didn't match the expected schema.");
  return parsed.data;
}

/* ---------------- Anthropic (Claude) ---------------- */

let anthropic: Anthropic | null = null;

async function callAnthropic<T>(
  model: string,
  opts: { system: string; user: string; schema: z.ZodType<T>; effort: Effort },
): Promise<T> {
  try {
    // Resolves ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / `ant auth login` profile.
    anthropic ??= new Anthropic();
    const stream = anthropic.beta.messages.stream({
      model,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new AiError("The model declined this request.", 422);
    if (msg.stop_reason === "max_tokens") throw new AiError("Response was cut off (max_tokens). Try fewer questions.");
    if (!msg.parsed_output) throw new AiError("Model returned output that didn't match the schema.");
    return msg.parsed_output;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
      throw new AiError("Anthropic credentials missing or invalid. Set ANTHROPIC_API_KEY in .env.", 401);
    if (e instanceof Anthropic.RateLimitError) throw new AiError("Rate limited by the Anthropic API. Retry shortly.", 429);
    if (e instanceof Anthropic.APIError) throw new AiError(`Anthropic API error ${e.status}: ${e.message}`);
    // Thrown when no credential can be resolved.
    if (e instanceof Anthropic.AnthropicError)
      throw new AiError(`AI unavailable: ${e.message}. Set ANTHROPIC_API_KEY in .env.`, 401);
    throw e;
  }
}
