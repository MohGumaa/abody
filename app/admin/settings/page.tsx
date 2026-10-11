import type { Metadata } from "next";
import { SiteSettingsForm } from "@/components/admin/SiteSettingsForm";
import { adminMetadata, requireAdmin } from "@/lib/admin";
import { readSiteContent } from "@/lib/site-content";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Settings");
}

export default async function AdminSettingsPage() {
  await requireAdmin();
  const row = await readSiteContent();

  return (
    <>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted">Basic store details shown to customers.</p>
      </div>
      <div className="max-w-2xl">
        <SiteSettingsForm initial={{ contactEmail: row?.contactEmail ?? "" }} />
      </div>
    </>
  );
}
