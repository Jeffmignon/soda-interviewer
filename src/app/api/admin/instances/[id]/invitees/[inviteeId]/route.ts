import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { deleteInvitee } from "@/lib/store";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; inviteeId: string }> },
) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id, inviteeId } = await params;
  const ok = await deleteInvitee(inviteeId, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
