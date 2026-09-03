import { InterviewRoom } from "@/components/interview/InterviewRoom";
import { asUIMessages } from "@/lib/soda/messages";
import { lookupPublicToken } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const found = await lookupPublicToken(token);

  return (
    <InterviewRoom
      token={token}
      initial={
        found
          ? {
              kind: found.kind,
              situationOfInterest: found.instance.situationOfInterest,
              inviteeName: found.invitee?.name ?? null,
              status: found.interview?.status ?? "not_started",
              completed:
                found.interview?.status === "completed" || found.interview?.status === "ended_early",
              startedAt: found.interview?.startedAt ?? null,
              messages: asUIMessages(found.interview?.messages ?? []),
            }
          : null
      }
    />
  );
}
