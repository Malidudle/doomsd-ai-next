import { convertToModelMessages, streamText, type UIMessage } from 'ai';
import { ollama } from 'ollama-ai-provider-v2';

export const maxDuration = 60;

const ALLOWED_MODELS = [
  'qwen3.5:0.8b',
  'qwen3.5:4b',
  'qwen3:latest',
];

export async function POST(req: Request) {
  const { messages, model }: { messages: UIMessage[]; model?: string } =
    await req.json();

  const selectedModel =
    model && ALLOWED_MODELS.includes(model) ? model : 'qwen3.5:4b';

  const result = streamText({
    model: ollama(selectedModel),
    system: 'You are a helpful assistant. Be concise.',
    messages: await convertToModelMessages(messages),
    providerOptions: {
      ollama: { think: false },
    },
  });

  return result.toUIMessageStreamResponse();
}
