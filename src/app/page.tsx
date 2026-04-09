import { ErrorBoundary } from "@/components/ErrorBoundary/ErrorBoundary";
import { LocatorPage } from "@/components/LocatorPage/LocatorPage";

export default function HomePage() {
  return (
    <ErrorBoundary>
      <LocatorPage />
    </ErrorBoundary>
  );
}
