import Link from "next/link";
import { CopyLink } from "@/components/copy-link";
import { getReferralRepository, loadReferralState } from "@/server/referrals/service";
import { DEFAULT_SITE_ORIGIN, REFERRAL_POINTS } from "@/server/referrals/logic";
import { formatNumber } from "@/lib/utils";

function safeImage(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export default async function ReferralsPage() {
  const store = getReferralRepository();
  let board: Awaited<ReturnType<typeof loadReferralState>>["board"] = [];
  let history: Awaited<ReturnType<typeof loadReferralState>>["history"] = [];
  let unavailable = false;
  if (!store) unavailable = true;
  else {
    try {
      const state = await loadReferralState(store);
      board = state.board;
      history = [...state.history].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      unavailable = true;
    }
  }

  return (
    <div className="space-y-4">
      <section className="border border-line bg-panel p-4 sm:p-6">
        <p className="text-xs font-medium text-blue">Callout Drop</p>
        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Top 100 referrers</h1>
        <p className="mt-4 max-w-2xl text-mute">
          A referral link is created from your Pump.fun username after your profile and wallet address are connected. It uses {DEFAULT_SITE_ORIGIN}. When someone joins from that link, you receive {REFERRAL_POINTS} PTS and they receive {REFERRAL_POINTS} PTS.
        </p>
      </section>

      {unavailable ? (
        <p className="border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          Referral history is saved with the Firebase API. Add FIREBASE_PROJECT_ID and FIREBASE_API_KEY on the server to load it. Stored referrals are not deleted.
        </p>
      ) : null}

      {board.length === 0 && !unavailable ? (
        <p className="border border-line bg-navy p-4 text-sm text-mute">No referrals have been saved yet.</p>
      ) : null}

      {board.length > 0 ? <ol className="border border-line bg-panel">
        {board.map((row, index) => {
          const image = safeImage(row.profileImage);
          return (
            <li key={row.username} className="grid grid-cols-[2.5rem_3.5rem_1fr] items-center gap-3 border-t border-line px-3 py-3 first:border-t-0 sm:px-4">
              <p className="font-display text-lg tabular-nums text-mute">{index + 1}</p>
              {image ? (
                <img src={image} alt="" className="h-14 w-14 border border-line object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center border border-line bg-navy text-lg font-semibold text-blue">
                  {row.username.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <Link href={`/p/${encodeURIComponent(row.username)}`} className="block truncate font-display text-xl hover:text-blue">
                  {row.username}
                </Link>
                <p className="mt-1 text-sm text-mist">
                  {row.referrals} referrals · {formatNumber(row.points)} PTS
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-xs text-blue">{row.link}</p>
                  <CopyLink link={row.link} compact />
                </div>
              </div>
            </li>
          );
        })}
      </ol> : null}

      <section className="border border-line bg-panel p-4 sm:p-5">
        <h2 className="font-display text-xl">Referral history</h2>
        <p className="mt-2 text-sm text-mute">Each join is kept. This list does not remove older referrals.</p>
        {history.length === 0 ? (
          <p className="mt-4 text-sm text-mute">No referral history is stored yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {history.map((row) => (
              <li key={row.id} className="border border-line bg-navy p-3 text-sm">
                <p>
                  <span className="text-mist">{row.referrerUsername}</span>
                  <span className="text-mute"> referred </span>
                  <span className="text-mist">{row.referredUsername}</span>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <p className="min-w-0 flex-1 break-all text-xs text-blue">{row.referralLink}</p>
                  <CopyLink link={row.referralLink} compact />
                </div>
                <p className="mt-1 text-mute">
                  {row.domain} · {row.referrerPoints} PTS to the referrer · {row.referredPoints} PTS to the new account
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
