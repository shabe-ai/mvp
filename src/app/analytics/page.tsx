import ConvexProviderWrapper from "@/components/ConvexProvider";
import AnalyticsPageClient from "./AnalyticsPageClient";

export default function AnalyticsPage() {
  return (
    <ConvexProviderWrapper>
      <AnalyticsPageClient />
    </ConvexProviderWrapper>
  );
}
