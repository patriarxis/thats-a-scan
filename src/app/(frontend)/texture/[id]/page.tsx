import type { Metadata } from "next";
import { ErrorBoundary } from "@/components/ErrorBoundary/ErrorBoundary";
import { AtlasPage } from "@/features/atlas/AtlasPage";
import { findTextureById } from "@/domain/textures/repository";
import { getTextureSeoText } from "@/lib/seo";
import { getTextureTitle } from "@/domain/textures/types";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const texture = await findTextureById(id);
  if (!texture) {
    return { title: id };
  }
  const title = getTextureTitle(texture);
  const seo = getTextureSeoText(id, title, texture.properties.address ?? "");
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: `/texture/${id}` },
  };
}

export default function TexturePage() {
  return (
    <ErrorBoundary>
      <AtlasPage />
    </ErrorBoundary>
  );
}
