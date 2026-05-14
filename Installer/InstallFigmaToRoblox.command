#!/bin/bash
ScriptDir="$(cd "$(dirname "$0")" && pwd)"

/bin/bash "$ScriptDir/InstallFigmaToRoblox.sh" "$@"
Status=$?

echo
if [ "$Status" -ne 0 ]; then
  echo "Install failed."
fi

read -r -p "Press Return to close this window..."
exit "$Status"
