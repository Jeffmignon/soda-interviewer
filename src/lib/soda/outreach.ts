import type { Instance, Invitee } from "@/lib/types";

export function interviewUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/i/${token}`;
}

export function emailCopy(input: {
  invitee: Invitee;
  instance: Instance;
  url: string;
  fromName?: string;
}): { subject: string; body: string } {
  const first = input.invitee.name.split(" ")[0] || input.invitee.name;
  const from = input.fromName ?? "Jeff Mignon";
  const subject = `A conversation about ${input.instance.situationOfInterest}`;
  const body = `Hi ${first},

I'd like an hour with you on ${input.instance.situationOfInterest}. This is a structured conversation, not a survey — I want how you see it, in your words.

Your private link (do not share; it is only for you):
${input.url}

No preparation needed. I'll follow what you raise.

Thank you,
${from}`;
  return { subject, body };
}

export function linkedinCopy(input: {
  invitee: Invitee;
  instance: Instance;
  url: string;
  fromName?: string;
}): string {
  const first = input.invitee.name.split(" ")[0] || input.invitee.name;
  return `Hi ${first} — I'd value a private conversation with you about ${input.instance.situationOfInterest}. Not a survey: I'll follow your view of the issue. Your link (only for you): ${input.url} — ${input.fromName ?? "Jeff"}`;
}

export function instanceGenericEmail(input: {
  instance: Instance;
  url: string;
  fromName?: string;
}): { subject: string; body: string } {
  const from = input.fromName ?? "Jeff Mignon";
  return {
    subject: `A conversation about ${input.instance.situationOfInterest}`,
    body: `I'd like an hour with you on ${input.instance.situationOfInterest}. This is a structured conversation, not a survey.

Private interview link:
${input.url}

No preparation needed.

${from}`,
  };
}
