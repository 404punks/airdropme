"use client";

import dynamic from "next/dynamic";

const ClaimFlow = dynamic(() => import("@/components/claim-flow").then((mod) => mod.ClaimFlow), {
  ssr: false,
  loading: () => <p className="text-sm text-mute">Loading wallet adapter…</p>,
});

export function ClaimClient({ rpcUrl }: { rpcUrl: string }) {
  return <ClaimFlow rpcUrl={rpcUrl} />;
}
