import { activePlan } from "@/lib/billing/subscription";
import type { schema } from "@/lib/db";
import { HeaderNavigation } from "./HeaderNavigation";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { Brand } from "./ui/Brand";

/** Application bar for signed-in pages. */
export async function Header({ user }: { user: schema.User }) {
  const { plan } = await activePlan(user.id);
  const displayName = user.name ?? user.githubLogin ?? user.email.split("@")[0]!;

  return (
    <header className="app-header">
      <div className="page-container">
        <div className="flex h-14 items-center gap-3">
          <Brand href="/dashboard" />
          <div className="mx-2 hidden h-6 w-px bg-line md:block" aria-hidden="true" />
          <HeaderNavigation variant="desktop" />
          <div className="ms-auto flex items-center gap-2">
            <ThemeToggle compact />
            <UserMenu displayName={displayName} email={user.email} avatarUrl={user.avatarUrl} planName={plan.name} />
          </div>
        </div>
        <HeaderNavigation variant="mobile" />
      </div>
    </header>
  );
}
