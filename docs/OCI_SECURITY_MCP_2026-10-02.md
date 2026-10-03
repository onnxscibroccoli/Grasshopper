# OCI Security MCP Evidence 2026-10-02

## Identity

Live OCI IMDSv2 confirmed:

- display name: Grasshopper-Workstation
- region: us-ashburn-1
- availability domain: US-ASHBURN-AD-1
- role tag: agent-workstation
- project tag: Grasshopper

The AWS metadata endpoint does not identify this host as an EC2 instance.

## MCP

The grasshopper-oci-security MCP is installed in the Grasshopper repository and configured in OpenClaw as a local stdio MCP with operator approval mode prompt.

Probe result:

8 tools, Codex approval prompt

## Security contract

The MCP:

- does not expose arbitrary shell execution;
- requires strict SSH host verification when remote mode is used;
- disables SSH agent forwarding;
- records action metadata to a 0700/0600 audit directory;
- requires confirm=true for write tools;
- uses sudo -n so it cannot prompt for or capture a password.

## Current privilege limitation

sudo -n true currently reports that a password is required for the grasshopper user.

Therefore privileged MCP actions are NOT_PROVEN on the live workstation. The MCP is deliberately fail-closed instead of weakening the workstation's authentication boundary.

The correct next step is a root-installed least-privilege sudoers policy for fixed, root-owned security wrappers. Do not grant the MCP unrestricted sudo, su, or arbitrary bash.

