import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { getInterview, listInterviews } from "@/lib/store";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await params;
  const url = new URL(request.url);
  const instanceId = url.searchParams.get("instanceId");
  const interview = await getInterview(id);
  if (!interview) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (instanceId && interview.instanceId !== instanceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ interview });
}

export async function POST(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = (await request.json()) as { instanceId?: string };
  if (!body.instanceId) {
    return NextResponse.json({ error: "instanceId required" }, { status: 400 });
  }
  const interviews = await listInterviews(body.instanceId);
  return NextResponse.json({ interviews });
}
