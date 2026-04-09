import { ErrorBoundary, LocatorPage } from "@/components";

export default function HomePage() {
  return (
    <ErrorBoundary>
      <LocatorPage />
    </ErrorBoundary>
  );
}
