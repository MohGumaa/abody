import type { Metadata } from "next";
import { InfoPage, infoMetadata } from "@/components/info/InfoPage";

export function generateMetadata(): Promise<Metadata> {
  return infoMetadata("about");
}

export default function AboutPage() {
  return <InfoPage page="about" />;
}
