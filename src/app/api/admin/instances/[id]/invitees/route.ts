import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-guard";
import { emailCopy, instanceGenericEmail, interviewUrl, linkedinCopy } from "@/lib/soda/outreach";
import { createInvitee, getInstance, listInvitees } from "@/lib/store";

function originFrom(request: Request): string {
  const url = new URL(request.url);
  return process.env.APP_URL?.replace(/\/$/, "") || `${url.protocol}//${url.host}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await params;
  const instance = await getInstance(id);
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const origin = originFrom(request);
  const invitees = await listInvitees(id);
  return NextResponse.json({
    instanceUrl: interviewUrl(origin, instance.token),
    instanceEmail: instanceGenericEmail({ instance, url: interviewUrl(origin, instance.token) }),
    invitees: invitees.map((invitee) => {
      const url = interviewUrl(origin, invitee.token);
      return {
        ...invitee,
        url,
        email: emailCopy({ invitee, instance, url }),
        linkedin: linkedinCopy({ invitee, instance, url }),
      };
    }),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await params;
  const instance = await getInstance(id);
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = (await request.json()) as { name?: string; email?: string; linkedinUrl?: string };
  if (!body.name?.trim() || !body.email?.trim()) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }
  const invitee = await createInvitee({
    instanceId: id,
    name: body.name,
    email: body.email,
    linkedinUrl: body.linkedinUrl,
  });
  const origin = originFrom(request);
  const url = interviewUrl(origin, invitee.token);
  return NextResponse.json({
    invitee: {
      ...invitee,
      url,
      email: emailCopy({ invitee, instance, url }),
      linkedin: linkedinCopy({ invitee, instance, url }),
    },
  });
}
