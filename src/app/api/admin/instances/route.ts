import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { createInstance, getClient, getProject, listInstances } from "@/lib/store";

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  const instances = await listInstances();
  return NextResponse.json({ instances });
}

export async function POST(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = (await request.json()) as {
    clientId?: string;
    projectId?: string;
    name?: string;
    situationOfInterest?: string;
    interviewReason?: string;
    targetAudience?: string;
    interviewGoal?: string;
  };
  if (
    !body.clientId ||
    !body.projectId ||
    !body.name?.trim() ||
    !body.situationOfInterest?.trim() ||
    !body.targetAudience?.trim() ||
    !body.interviewGoal?.trim()
  ) {
    return NextResponse.json(
      {
        error:
          "clientId, projectId, name, situationOfInterest, targetAudience, and interviewGoal are required.",
      },
      { status: 400 },
    );
  }
  const client = await getClient(body.clientId);
  const project = await getProject(body.projectId);
  if (!client || !project || project.clientId !== client.id) {
    return NextResponse.json({ error: "Client and project must belong together." }, { status: 400 });
  }
  const instance = await createInstance({
    clientId: body.clientId,
    projectId: body.projectId,
    name: body.name,
    situationOfInterest: body.situationOfInterest,
    interviewReason: body.interviewReason,
    targetAudience: body.targetAudience,
    interviewGoal: body.interviewGoal,
  });
  return NextResponse.json({ instance });
}
