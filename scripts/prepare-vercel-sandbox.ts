import { Sandbox } from "@vercel/sandbox";

// Run with deployment OIDC or the official SDK's team/project/token credentials.
// Only trusted tools are baked in. Generated files and app secrets never enter it.
const sandbox = await Sandbox.create({ persistent: false, timeout: 900_000 });
let snapshotted = false;
try {
  const result = await sandbox.runCommand({
    cmd: "bash",
    args: [
      "-lc",
      `set -e
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends postgresql fonts-noto-core
sudo mkdir -p /opt/runner
sudo chown ubuntu:ubuntu /opt/runner
cd /opt/runner
npm install --ignore-scripts --no-audit --no-fund playwright-core@1.61.0
PLAYWRIGHT_BROWSERS_PATH=/opt/runner/browsers npx playwright-core install chromium --with-deps
PLAYWRIGHT_BROWSERS_PATH=/opt/runner/browsers node --input-type=module -e "import {chromium} from 'playwright-core'; import {symlinkSync} from 'node:fs'; symlinkSync(chromium.executablePath(),'/opt/runner/chromium')"
sudo chmod -R a+rX /opt/runner
sudo useradd --create-home --shell /bin/bash app
sudo chown app:ubuntu /home/app
sudo chmod 770 /home/app
/opt/runner/chromium --version
pg_lsclusters`,
    ],
    timeoutMs: 850_000,
  });
  if (result.exitCode) throw new Error((await result.output()).slice(-3000));
  const snapshot = await sandbox.snapshot({ expiration: 0 });
  snapshotted = true;
  console.log(snapshot.snapshotId);
} finally {
  if (!snapshotted) await sandbox.stop();
}
