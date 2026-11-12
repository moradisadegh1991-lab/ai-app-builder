import { HeaderNavigation } from "./HeaderNavigation";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { Brand } from "./ui/Brand";

/** Presentation shared by application pages; account lookups stay on the server. */
export function HeaderBar({
  displayName,
  email,
  avatarUrl,
  planName,
}: {
  displayName: string;
  email: string;
  avatarUrl: string | null;
  planName: string;
}) {
  return (
    <header className="app-header">
      <div className="page-container">
        <div className="flex h-17 items-center gap-3">
          <Brand href="/dashboard" />
          <div className="mx-2 hidden h-6 w-px bg-line md:block" aria-hidden="true" />
          <HeaderNavigation variant="desktop" />
          <div className="ms-auto flex items-center gap-2">
            <ThemeToggle compact />
            <UserMenu displayName={displayName} email={email} avatarUrl={avatarUrl} planName={planName} />
          </div>
        </div>
        <HeaderNavigation variant="mobile" />
      </div>
    </header>
  );
}
