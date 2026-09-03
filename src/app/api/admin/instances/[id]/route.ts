import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { deleteInstance, getInstanceBundle, updateInstance } from "@/lib/store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await params;
  const bundle = await getInstanceBundle(id);
  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(bundle);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await params;
  const body = (await request.json()) as {
    name?: string;
    situationOfInterest?: string;
    interviewReason?: string;
    targetAudience?: string;
    interviewGoal?: string;
  };
  const instance = await updateInstance(id, body);
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ instance });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await params;
  await deleteInstance(id);
  return NextResponse.json({ ok: true });
}
