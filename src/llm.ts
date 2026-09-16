import "dotenv/config";
import { SupportTicketSchema, type SupportTicket } from "./schemas";
import type { LLMResult, LLMUsage } from "./types";

import {
  RateLimitError,
  TimeoutError,
  APIError,
} from "./errors";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is missing");
}


async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  timeoutMs = 10_000
): Promise<{ response: Response; retries: number }> {
  let retries = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return {
          response,
          retries,
        };
      }

      if (response.status === 429) {
        if (attempt === maxRetries) {
          throw new RateLimitError(
            "OpenAI rate limit exceeded after retries"
          );
        }

        const retryAfter = response.headers.get("retry-after");

        const baseDelay = retryAfter
          ? Number(retryAfter) * 1000
          : 2 ** attempt * 1000;

        const jitter = Math.random() * 500;
        const delay = baseDelay + jitter;

        retries++;

        console.log(
          `⚠️ Rate limit. Retry dans ${Math.round(delay)}ms...`
        );

        await sleep(delay);
        continue;
      }

      if (response.status >= 500) {
        if (attempt === maxRetries) {
          throw new APIError(
            `OpenAI server error: ${response.status}`,
            response.status
          );
        }

        const baseDelay = 2 ** attempt * 1000;
        const jitter = Math.random() * 500;
        const delay = baseDelay + jitter;

        retries++;

        console.log(
          `⚠️ Server error ${response.status}. Retry dans ${Math.round(delay)}ms...`
        );

        await sleep(delay);
        continue;
      }

      throw new APIError(
        `OpenAI API error: ${response.status}`,
        response.status
      );
    } catch (error) {
      clearTimeout(timeout);

      // Ne pas retraiter nos propres erreurs métier/API
      if (error instanceof APIError || error instanceof RateLimitError) {
        throw error;
      }

      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        if (attempt === maxRetries) {
          throw new TimeoutError(
            `OpenAI request timed out after ${timeoutMs}ms`
          );
        }

        const baseDelay = 2 ** attempt * 1000;
        const jitter = Math.random() * 500;
        const delay = baseDelay + jitter;

        retries++;

        console.log(
          `⏱️ Timeout. Retry dans ${Math.round(delay)}ms...`
        );

        await sleep(delay);
        continue;
      }

      if (attempt === maxRetries) {
        throw error;
      }

      const baseDelay = 2 ** attempt * 1000;
      const jitter = Math.random() * 500;
      const delay = baseDelay + jitter;

      retries++;

      console.log(
        `⚠️ Network error. Retry dans ${Math.round(delay)}ms...`
      );

      await sleep(delay);
    }
  }

  throw new Error("Retry limit exceeded");
}

export async function classifySupportTicket(message: string) : Promise<LLMResult<SupportTicket>> {
  const startTime = Date.now();

  try {
    const { response, retries }  = await fetchWithRetry("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",

        input: `
Tu es un assistant de support informatique.

Analyse le message suivant :

"${message}"

Retourne uniquement les informations demandées.
`,

        text: {
          format: {
            type: "json_schema",
            name: "support_ticket",
            strict: true,
            schema: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  enum: [
                    "authentication",
                    "technical",
                    "billing",
                    "bug",
                    "other",
                  ],
                },
                priority: {
                  type: "string",
                  enum: ["low", "medium", "high"],
                },
                summary: {
                  type: "string",
                },
              },
              required: ["category", "priority", "summary"],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI API error: ${response.status} ${await response.text()}`
      );
    }

    const data = await response.json();

    const latency = Date.now() - startTime;

    const usage: LLMUsage = {
      model: data.model,
      latencyMs: latency,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
      retries,
    };


    const text = data.output
      ?.find((item: any) => item.type === "message")
      ?.content
      ?.find((content: any) => content.type === "output_text")
      ?.text;

    if (!text) {
      throw new Error("No output text returned by OpenAI");
    }

    const rawTicket = JSON.parse(text);

    const ticket =  SupportTicketSchema.parse(rawTicket);
    return {
      result: ticket,
      usage,
    }
  } catch (error) {
    console.error("❌ AI classification failed:", error);

    throw new Error("Unable to classify support ticket");
  }
}