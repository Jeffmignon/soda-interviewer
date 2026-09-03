import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Prefer Vercel AI Gateway (AI_GATEWAY_API_KEY or Vercel OIDC).
 * Fall back to OpenAI when only OPENAI_API_KEY is set.
 */
export function getModel(): LanguageModel | string {
  const configured = process.env.AI_MODEL?.trim() || "openai/gpt-4o";

  if (process.env.OPENAI_API_KEY && !process.env.AI_GATEWAY_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const id = configured.includes("/") ? configured.split("/").slice(1).join("/") : configured;
    return openai(id);
  }

  return configured;
}

export function aiConfigured(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.VERCEL_OIDC_TOKEN ||
      process.env.VERCEL,
  );
}
