import { CopyLink } from "@/components/copy-link";
import { ReferralUsdc, UsdcInline } from "@/components/usdc-amount";
import { formatWhen } from "@/lib/utils";
import type { ReferralHistoryRecord } from "@/server/referrals/logic";

function safeImage(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function ReferralPanel({
  username,
  link,
  points,
  made,
  joined,
  history,
  unavailable,
}: {
  username: string | null;
  link: string | null;
  points: number;
  made: number;
  joined: number;
  history: ReferralHistoryRecord[];
  unavailable: boolean;
}) {
  return (
    <section className="border border-line bg-panel p-4 sm:p-5">
      <h2 className="font-display text-xl">Referral</h2>
      <p className="mt-2 text-sm text-mute"><UsdcInline text="Each joined referral gives you 1% of that account's USDC. Referral history stays in Firebase." /></p>
      {!username ? (
        <p className="mt-4 text-sm text-mute">Referral links use a Pump.fun username. This profile does not have one yet.</p>
      ) : !link ? (
        <p className="mt-4 text-sm text-mute">A referral link is created from this username after the profile address is connected.</p>
      ) : (
        <div className="mt-4">
          <CopyLink link={link} />
        </div>
      )}
      {unavailable ? (
        <p className="mt-4 text-sm text-warn">Referral history could not be loaded from Firebase. Nothing on this page deletes stored referrals.</p>
      ) : (
        <p className="mt-4 text-sm text-mist">
          <ReferralUsdc sharePoints={points} /> from referrals · {made} joined from your link
          {joined > 0 ? " · you joined from a referral" : ""}
        </p>
      )}
      {history.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {history.map((row) => {
            const outgoing = username != null && row.referrerUsername.toLowerCase() === username.toLowerCase();
            const image = safeImage(outgoing ? row.referredImage : row.referrerImage);
            const name = outgoing ? row.referredUsername : row.referrerUsername;
            return (
              <li key={row.id} className="grid grid-cols-[3rem_1fr] gap-3 border border-line bg-navy p-3">
                {image ? (
                  <img src={image} alt="" className="h-12 w-12 border border-line object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center border border-line text-sm font-semibold text-blue">
                    {name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{name}</p>
                  <p className="text-sm text-mute">
                    {outgoing ? (
                      <>
                        Joined with your link · <ReferralUsdc sharePoints={row.referrerPoints} />, 1% of their <UsdcInline text="USDC" />
                      </>
                    ) : (
                      <UsdcInline text="You joined with this link. The referrer receives 1% of this USDC." />
                    )}
                  </p>
                  <p className="text-xs text-mute">{formatWhen(row.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
