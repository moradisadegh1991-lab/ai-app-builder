import { activePlan } from "@/lib/billing/subscription";
import type { schema } from "@/lib/db";
import { HeaderBar } from "./HeaderBar";

/** Application bar for signed-in pages. */
export async function Header({ user }: { user: schema.User }) {
  const { plan } = await activePlan(user.id);
  const displayName = user.name ?? user.githubLogin ?? user.email.split("@")[0]!;

  return <HeaderBar displayName={displayName} email={user.email} avatarUrl={user.avatarUrl} planName={plan.name} />;
}
