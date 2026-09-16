import { classifySupportTicket } from "./llm";
import {
  RateLimitError,
  TimeoutError,
  APIError,
} from "./errors";

const message =
  "Depuis ce matin je n'arrive plus à me connecter à mon compte.";

try {
  const { result: ticket, usage } =
  await classifySupportTicket(message);

  console.log(ticket);
  console.log("📊 Usage:", usage);

  if (ticket.priority === "high") {
    console.log("🚨 Escalade automatique");
  }
} catch (error) {
  if (error instanceof RateLimitError) {
    console.error("🛑 Trop de requêtes vers l'API");
  } else if (error instanceof TimeoutError) {
    console.error("⏱️ Le LLM n'a pas répondu à temps");
  } else if (error instanceof APIError) {
    console.error(
      `❌ Erreur API OpenAI (${error.status})`
    );
  } else {
    console.error("❌ Erreur inattendue", error);
  }

  process.exit(1);
}