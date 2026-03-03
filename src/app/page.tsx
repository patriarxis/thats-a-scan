import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LocatorExperience } from "@/components/locator/LocatorExperience";

export default function HomePage() {
  return (
    <ErrorBoundary>
      <LocatorExperience />
    </ErrorBoundary>
  );
}
