import type { UIMessage } from "ai";
import { createId } from "@/lib/ids";

export function textFromMessage(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function transcriptFromMessages(messages: UIMessage[]): string {
  return messages
    .map((m) => {
      const who = m.role === "user" ? "Guest" : "Interviewer";
      return `${who}: ${textFromMessage(m)}`;
    })
    .filter((line) => !line.endsWith(":"))
    .join("\n\n");
}

export function assistantMessage(text: string): UIMessage {
  return {
    id: createId(),
    role: "assistant",
    parts: [{ type: "text", text }],
  };
}

export function asUIMessages(value: unknown): UIMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object" && "role" in item && "parts" in item) as UIMessage[];
}

export function publicInstanceView(input: {
  situationOfInterest: string;
  inviteeName: string | null;
  status: string;
  interviewToken: string | null;
  completed: boolean;
}) {
  return {
    situationOfInterest: input.situationOfInterest,
    inviteeName: input.inviteeName,
    status: input.status,
    interviewToken: input.interviewToken,
    completed: input.completed,
  };
}
