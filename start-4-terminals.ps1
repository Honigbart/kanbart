$dir = Split-Path -Parent $MyInvocation.MyCommand.Definition

wt -w 0 -d "$dir" pwsh `
  ';' split-pane -H -d "$dir" pwsh `
  ';' move-focus left `
  ';' split-pane -V -d "$dir" pwsh `
  ';' move-focus right `
  ';' split-pane -V -d "$dir" pwsh