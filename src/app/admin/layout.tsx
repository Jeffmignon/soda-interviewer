import { AdminHeader } from "@/components/admin/AdminHeader";

export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full">
      <AdminHeader />
      <div className="px-6 py-10 md:px-10">{children}</div>
    </div>
  );
}
