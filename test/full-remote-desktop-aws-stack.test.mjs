import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const stack = fs.readFileSync("infra/aws/remote-desktop-stack.yaml", "utf8");
const host = fs.readFileSync("scripts/reconstruct-remote-desktop-host.sh", "utf8");

test("AWS stack provisions the complete infrastructure layers", () => {
  for (const token of [
    "AWS::EC2::VPC",
    "AWS::EC2::LaunchTemplate",
    "NestedVirtualization: enabled",
    "AWS::RDS::DBInstance",
    "AWS::Cognito::UserPool",
    "AWS::Cognito::UserPoolClient",
    "AWS::CloudFront::Distribution",
    "AWS::SecretsManager::Secret",
    "UserData:",
    "git -C /opt/grasshopper reset --hard ${GrasshopperCommit}"
  ]) assert.match(stack, new RegExp(token.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\    "AWS::SecretsManager::Secret"
  ]) assert.match(stack, new RegExp(token.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\$&")));")));
});

test("AWS stack has no SSH ingress and uses encrypted private PostgreSQL", () => {
  assert.doesNotMatch(stack, /FromPort:\s*22/);
  assert.match(stack, /PubliclyAccessible:\s*false/);
  assert.match(stack, /StorageEncrypted:\s*true/);
  assert.match(stack, /MultiAZ:\s*true/);
});

test("host reconstruction verifies the Kali image before use", () => {
  assert.match(host, /gpg --batch --verify/);
  assert.match(host, /sha256sum -c/);
  assert.match(host, /kali-linux-\$KALI_QEMU_DATE-qemu-amd64\.7z/);
  assert.match(host, /kali-desktop-xfce,firefox-esr,qemu-guest-agent/);
});

test("host reconstruction keeps VNC and noVNC local", () => {
  assert.match(host, /-localhost/);
  assert.match(host, /127\.0\.0\.1:6080 127\.0\.0\.1:5900/);
});
