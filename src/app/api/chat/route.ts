import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { ollama } from "ollama-ai-provider-v2";

export const maxDuration = 60;

const ALLOWED_MODELS = ["qwen3.5:0.8b", "qwen3.5:4b"];

export async function POST(req: Request) {
  const {
    messages,
    model,
    locationContext,
  }: { messages: UIMessage[]; model?: string; locationContext?: string } =
    await req.json();

  const selectedModel =
    model && ALLOWED_MODELS.includes(model) ? model : "qwen3.5:4b";

  const system = locationContext
    ? `You are a helpful assistant. Be concise.\n\nThe user has shared their location. Here are nearby points of interest:\n${locationContext}\nUse this to answer location questions. Include distances. If data seems incomplete, suggest the user go online to refresh.`
    : "You are a helpful assistant. Be concise.";

  const result = streamText({
    model: ollama(selectedModel),
    system,
    messages: await convertToModelMessages(messages),
    providerOptions: {
      ollama: { think: false },
    },
  });

  return result.toUIMessageStreamResponse();
}
