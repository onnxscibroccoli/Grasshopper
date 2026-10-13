#!/usr/bin/env sh
# Execute from root of a checked-out Grasshopper repo, on Termux or Linux.
# Never installs packages or invokes cloud auth/provisioning on its own.
set -eu
if ! command -v python3 >/dev/null 2>&1; then
  echo 'Python 3 required. Install via the official Termux pkg manager.' >&2
  exit 2
fi
if [ ! -f worker-network/workerctl.py ]; then
  echo 'Run from the root of your Grasshopper repo.' >&2
  exit 2
fi
printf '[1/3] Validate local catalog and Python code\n'
python3 -m unittest discover -s worker-network/tests -q
printf '[2/3] Show supported providers\n'
python3 worker-network/workerctl.py catalog
printf '[3/3] Choose cloud services (PLAN ONLY)\n'
exec python3 worker-network/workerctl.py wizard
