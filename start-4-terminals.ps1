$dir = Split-Path -Parent $MyInvocation.MyCommand.Definition

wt -w 0 -d "$dir" powershell `
  ';' split-pane -H -d "$dir" powershell `
  ';' move-focus left `
  ';' split-pane -V -d "$dir" powershell `
  ';' move-focus right `
  ';' split-pane -V -d "$dir" powershell