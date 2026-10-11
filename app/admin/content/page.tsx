import type { Metadata } from "next";
import { SiteContentForm, type SiteContentDefaults } from "@/components/admin/SiteContentForm";
import { adminMetadata, requireAdmin } from "@/lib/admin";
import { ar } from "@/lib/i18n/dictionaries/ar";
import { en } from "@/lib/i18n/dictionaries/en";
import { readSiteContent } from "@/lib/site-content";
import { siteContentFormValues } from "@/lib/site-content-rules";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Site content");
}

// The store's built-in text, shown as placeholders for the empty fields.
const DEFAULTS: SiteContentDefaults = {
  heroEyebrow: en.home.hero.eyebrow,
  heroEyebrowAr: ar.home.hero.eyebrow,
  heroTitle: en.home.hero.title,
  heroTitleAr: ar.home.hero.title,
  heroLead: en.home.hero.lead,
  heroLeadAr: ar.home.hero.lead,
  ctaTitle: en.home.cta.title,
  ctaTitleAr: ar.home.cta.title,
  ctaBody: en.home.cta.body,
  ctaBodyAr: ar.home.cta.body,
  ctaAction: en.home.cta.action,
  ctaActionAr: ar.home.cta.action,
};

export default async function AdminSiteContentPage() {
  await requireAdmin();
  const row = await readSiteContent();

  return (
    <>
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Site content</h1>
        <p className="text-sm text-muted">
          Home page text and sections, and the announcement bar, in English and Arabic.
        </p>
      </div>
      <div className="max-w-4xl">
        <SiteContentForm initial={siteContentFormValues(row)} defaults={DEFAULTS} />
      </div>
    </>
  );
}
