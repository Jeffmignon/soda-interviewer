import { createClient, createInvitee, createInstance, createProject } from "../src/lib/store";
import { interviewUrl } from "../src/lib/soda/outreach";
import { existsSync, readFileSync } from "node:fs";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq);
      let value = trimmed.slice(eq + 1);
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

async function main() {
  loadEnv();
  const origin = process.env.APP_URL || "http://localhost:3000";

  const client = await createClient({
    name: "North Harbor Health",
    website: "https://example.org/north-harbor",
    notes: "Demo client for local SODA interviews. Replace in production.",
  });

  const project = await createProject({
    clientId: client.id,
    name: "CME for busy clinicians",
    description: "Continuing medical education that has to fit real HCP lives.",
  });

  const instance = await createInstance({
    clientId: client.id,
    projectId: project.id,
    name: "CME — HCP sitting",
    situationOfInterest: "making CME fit the life of a busy clinician",
    interviewReason: "Understand friction, format, timing, and the ideal experience — not a satisfaction score.",
    targetAudience: "HCPs who need to take CME",
    interviewGoal:
      "understand how we can improve our CMEs to make them frictionless, 100% adapted to the lifestyle of busy HCPs, as personalized as possible — best format, best moment, ideal experience",
  });

  const invitee = await createInvitee({
    instanceId: instance.id,
    name: "Sam Okonkwo",
    email: "sam.okonkwo@example.org",
    linkedinUrl: "https://www.linkedin.com/in/example",
  });

  console.log("\nSODA demo instance created.\n");
  console.log(`Client:    ${client.name}`);
  console.log(`Project:   ${project.name}`);
  console.log(`Instance:  ${instance.name}`);
  console.log(`Audience:  ${instance.targetAudience}`);
  console.log(`Goal:      ${instance.interviewGoal}`);
  console.log(`Situation: ${instance.situationOfInterest}`);
  console.log("");
  console.log(`Admin:           ${origin}/admin`);
  console.log(`  password:      ${process.env.ADMIN_PASSWORD || "(set ADMIN_PASSWORD in .env.local)"}`);
  console.log(`Instance link:   ${interviewUrl(origin, instance.token)}`);
  console.log(`Invitee (Sam):   ${interviewUrl(origin, invitee.token)}`);
  console.log("");
  console.log("The guest is never asked which company or product this is for.");
  console.log("Sittings run 30–40 minutes. Off-goal answers do not steer the next question.");
  console.log("Outreach copy is available in admin — this script does not send email or LinkedIn.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
