import type { Metadata } from "next";
import { AdminConsole } from "@/components/admin/AdminConsole";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false, nocache: true },
};

/** Beadup's own admin. Everything sensitive is checked on the server (src/lib/admin.ts). */
export default function AdminPage() {
  return <AdminConsole />;
}
