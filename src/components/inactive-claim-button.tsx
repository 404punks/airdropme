export function InactiveClaimButton({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="inline-flex h-12 w-full cursor-not-allowed items-center justify-center border border-line bg-panel2 px-5 text-sm font-semibold text-mute"
      >
        Claim
      </button>
      <p className="mt-2 text-xs text-mute">Claim coming soon. This button is inactive.</p>
    </div>
  );
}
