import { CopyLink } from "@/components/copy-link";
import { formatNumber, formatWhen } from "@/lib/utils";
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
      <p className="mt-2 text-sm text-mute">Each joined referral gives 170 PTS to you and 170 PTS to the new account. Referral history stays in Firebase.</p>
      {!username || !link ? (
        <p className="mt-4 text-sm text-mute">Referral links use a Pump.fun username. This profile does not have one yet.</p>
      ) : (
        <div className="mt-4">
          <CopyLink link={link} />
        </div>
      )}
      {unavailable ? (
        <p className="mt-4 text-sm text-warn">Referral history could not be loaded from Firebase. Nothing on this page deletes stored referrals.</p>
      ) : (
        <p className="mt-4 text-sm text-mist">
          {formatNumber(points)} referral PTS · {made} joined from your link
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
                  <p className="text-sm text-mute">{outgoing ? "Joined with your link · 170 PTS" : "You joined with this link · 170 PTS"}</p>
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
