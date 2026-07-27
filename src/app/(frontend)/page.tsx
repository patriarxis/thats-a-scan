import type { Metadata } from "next";
import { ErrorBoundary } from "@/components/ErrorBoundary/ErrorBoundary";
import { AtlasPage } from "@/features/atlas/AtlasPage";
import { getHomeSeo } from "@/lib/seo";

const homeSeo = getHomeSeo();

export const metadata: Metadata = {
  title: homeSeo.title,
  description: homeSeo.description,
  alternates: { canonical: "/" },
  openGraph: { locale: "en_US", url: "/" },
};

export default function HomePage() {
  return (
    <ErrorBoundary>
      <AtlasPage />
    </ErrorBoundary>
  );
}
