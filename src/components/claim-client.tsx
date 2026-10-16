"use client";

import dynamic from "next/dynamic";

const ClaimFlow = dynamic(() => import("@/components/claim-flow").then((mod) => mod.ClaimFlow), {
  ssr: false,
  loading: () => <p className="text-sm text-mute">Loading wallet connection…</p>,
});

export function ClaimClient({
  rpcUrl,
  distributionEnabled,
  projectId = "",
}: {
  rpcUrl: string;
  distributionEnabled: boolean;
  projectId?: string;
}) {
  return <ClaimFlow rpcUrl={rpcUrl} distributionEnabled={distributionEnabled} projectId={projectId} />;
}
