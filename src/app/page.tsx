import { ErrorBoundary, LocatorExperience } from "@/components";

export default function HomePage() {
  return (
    <ErrorBoundary>
      <LocatorExperience />
    </ErrorBoundary>
  );
}
