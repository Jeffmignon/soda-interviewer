import { InstanceDesk } from "@/components/admin/InstanceDesk";
import { getInstanceBundle } from "@/lib/store";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function InstancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await getInstanceBundle(id);
  if (!bundle) notFound();
  return (
    <div className="mx-auto max-w-5xl">
      <InstanceDesk initial={bundle} />
    </div>
  );
}
