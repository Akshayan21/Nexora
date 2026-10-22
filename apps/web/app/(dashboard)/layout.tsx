import { DataBoundary } from "@/components/workspace/data-source";
import { CampaignProvider } from "@/components/workspace/campaign-context";
import { LeadsProvider } from "@/components/workspace/leads-context";
import { Shell } from "@/components/workspace/shell";
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DataBoundary><LeadsProvider>
      <CampaignProvider>
        <Shell>{children}</Shell>
      </CampaignProvider>
    </LeadsProvider></DataBoundary>
  );
}
