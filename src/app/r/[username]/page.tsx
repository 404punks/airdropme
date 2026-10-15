import { redirect } from "next/navigation";
import { parseIdentifier } from "@/server/validation/identifier";

export default async function ReferralLinkPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const parsed = parseIdentifier(decodeURIComponent(username));
  if (!parsed.ok || parsed.kind !== "username") redirect("/");
  redirect(`/?ref=${encodeURIComponent(parsed.lookup)}`);
}
