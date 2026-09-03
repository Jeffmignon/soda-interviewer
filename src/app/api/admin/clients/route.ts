import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { createClient, listClients } from "@/lib/store";

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  return NextResponse.json({ clients: await listClients() });
}

export async function POST(request: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = (await request.json()) as { name?: string; website?: string; notes?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  const client = await createClient({
    name: body.name,
    website: body.website,
    notes: body.notes,
  });
  return NextResponse.json({ client });
}
