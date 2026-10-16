import { describe, expect, it } from "vitest";
import {
  completeReferralSteps,
  emptyReferralBook,
  parseReferralBook,
  rememberWalletReferral,
} from "@/lib/saved-referral";

const alpha = {
  wallet: "WalletA",
  profileKey: "WalletA",
  username: "alpha",
  referralLink: "https://www.calloutdrop.app/r/alpha",
};

describe("saved wallet referrals", () => {
  it("keeps an existing referral link when a later write is empty", () => {
    const first = rememberWalletReferral(emptyReferralBook(), alpha);
    const second = rememberWalletReferral(first, {
      wallet: "WalletA",
      profileKey: "",
      username: null,
      referralLink: null,
    });
    expect(second.byWallet.WalletA).toMatchObject({
      profileKey: "WalletA",
      username: "alpha",
      referralLink: "https://www.calloutdrop.app/r/alpha",
    });
    const both = rememberWalletReferral(second, {
      wallet: "WalletB",
      profileKey: "beta",
      username: "beta",
      referralLink: "https://www.calloutdrop.app/r/beta",
    });
    expect(both.lastWallet).toBe("WalletB");
    expect(both.byWallet.WalletA.referralLink).toBe("https://www.calloutdrop.app/r/alpha");
    expect(both.byWallet.WalletB.referralLink).toBe("https://www.calloutdrop.app/r/beta");
  });

  it("keeps the referral book after the steps are marked complete", () => {
    const saved = completeReferralSteps(rememberWalletReferral(emptyReferralBook(), alpha));
    const again = rememberWalletReferral(saved, {
      wallet: "WalletA",
      profileKey: "WalletA",
      username: null,
      referralLink: null,
    });
    expect(again.stepsComplete).toBe(true);
    expect(again.byWallet.WalletA.referralLink).toBe("https://www.calloutdrop.app/r/alpha");
    const parsed = parseReferralBook(JSON.stringify(again));
    expect(parsed.stepsComplete).toBe(true);
    expect(parsed.lastWallet).toBe("WalletA");
    expect(parsed.byWallet.WalletA.referralLink).toBe("https://www.calloutdrop.app/r/alpha");
    expect(parseReferralBook("not-json")).toEqual(emptyReferralBook());
  });
});
