import { formatUsdc } from "@/server/points/calculate";

export function UsdcMark({ className = "h-[1em] w-[1em]" }: { className?: string }) {
  return <img src="/usdc.svg" alt="" className={`inline-block shrink-0 ${className}`} />;
}

export function UsdcWord({ className = "h-[1em] w-[1em]" }: { className?: string }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <UsdcMark className={className} />
      <span>USDC</span>
    </span>
  );
}

export function UsdcInline({ text }: { text: string }) {
  const parts = text.split(/(USDC)/g);
  return (
    <>
      {parts.map((part, index) =>
        part === "USDC" ? <UsdcWord key={index} /> : <span key={index}>{part}</span>,
      )}
    </>
  );
}

export function UsdcAmount({ points, markClassName = "h-4 w-4" }: { points: number; markClassName?: string }) {
  return (
    <span className="inline-flex items-center gap-[0.3em] align-middle">
      <span className="tabular-nums">${formatUsdc(points)}</span>
      <UsdcMark className={markClassName} />
      <span>USDC</span>
    </span>
  );
}
