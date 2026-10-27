import { env } from "../env";
import { googleEnabled } from "../integrations/google";

/** Which social sign-in buttons the landing page shows (only the ones that are configured). */
export function enabledSocialProviders() {
  return { github: env.githubConfigured(), google: googleEnabled() };
}
