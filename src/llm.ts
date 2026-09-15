import "dotenv/config";
import { SupportTicketSchema } from "./schemas";


const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is missing.");
}

export async function classifySupportTicket(
  message: string
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
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

  const text = data.output
    ?.find((item: any) => item.type === "message")
    ?.content
    ?.find((content: any) => content.type === "output_text")
    ?.text;

  if (!text) {
    throw new Error("No output text returned");
  }

  const rawTicket = JSON.parse(text);

  return SupportTicketSchema.parse(rawTicket);
}