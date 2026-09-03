import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { createProject, listProjects } from "@/lib/store";

export async function GET(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId") ?? undefined;
  return NextResponse.json({ projects: await listProjects(clientId) });
}

export async function POST(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = (await request.json()) as { clientId?: string; name?: string; description?: string };
  if (!body.clientId || !body.name?.trim()) {
    return NextResponse.json({ error: "clientId and name are required." }, { status: 400 });
  }
  const project = await createProject({
    clientId: body.clientId,
    name: body.name,
    description: body.description,
  });
  return NextResponse.json({ project });
}
