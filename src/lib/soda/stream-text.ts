import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";

export function streamApprovedText(
  text: string,
  originalMessages: UIMessage[],
  onFinish?: (messages: UIMessage[]) => Promise<void> | void,
) {
  const stream = createUIMessageStream({
    originalMessages,
    execute: async ({ writer }) => {
      const id = "t0";
      writer.write({ type: "text-start", id });
      const size = 42;
      for (let i = 0; i < text.length; i += size) {
        writer.write({ type: "text-delta", id, delta: text.slice(i, i + size) });
      }
      writer.write({ type: "text-end", id });
    },
    onFinish: async ({ messages }) => {
      await onFinish?.(messages);
    },
  });
  return createUIMessageStreamResponse({ stream });
}
