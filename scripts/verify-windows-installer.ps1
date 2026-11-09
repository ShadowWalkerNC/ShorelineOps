param([Parameter(Mandatory = $true)][string]$Installer)
$ErrorActionPreference = 'Stop'
$installerPath = (Resolve-Path -LiteralPath $Installer).Path
$registryRoots = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
)
$existing = $registryRoots | ForEach-Object {
  Get-ChildItem -LiteralPath $_ -ErrorAction SilentlyContinue | Get-ItemProperty -ErrorAction SilentlyContinue
} | Where-Object DisplayName -EQ 'ShorelineOps'
if ($existing) { throw 'Use a clean Windows account for installer acceptance. An existing installation was found.' }
$shortcuts = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'ShorelineOps.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Programs')) 'ShorelineOps.lnk')
)
foreach ($shortcut in $shortcuts) {
  if (Test-Path -LiteralPath $shortcut) { throw 'An existing ShorelineOps shortcut must be preserved. Use a clean account.' }
}
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('shoreline-installer-' + [Guid]::NewGuid().ToString('N'))
$installPath = Join-Path $testRoot 'win-unpacked'
New-Item -ItemType Directory -Path $testRoot | Out-Null
try {
  $installation = Start-Process -FilePath $installerPath -ArgumentList "/S /D=$installPath" -WindowStyle Hidden -Wait -PassThru
  if ($installation.ExitCode -ne 0) { throw "Installer failed with exit code $($installation.ExitCode)" }
  if (!(Test-Path -LiteralPath (Join-Path $installPath 'ShorelineOps.exe'))) { throw 'Installed executable missing' }
  & node (Join-Path $PSScriptRoot 'verify-packaged-desktop.cjs') $testRoot
  if ($LASTEXITCODE -ne 0) { throw 'Installed application failed its isolated runtime check' }
  Write-Output 'PASS Windows installation and installed application runtime'
} finally {
  $uninstaller = Join-Path $installPath 'Uninstall ShorelineOps.exe'
  if (Test-Path -LiteralPath $uninstaller) {
    $removal = Start-Process -FilePath $uninstaller -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
    if ($removal.ExitCode -ne 0) { throw "Test uninstaller failed with exit code $($removal.ExitCode)" }
  }
  $resolvedRoot = [IO.Path]::GetFullPath($testRoot)
  $temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if (!$resolvedRoot.StartsWith($temporaryRoot, [StringComparison]::OrdinalIgnoreCase) -or
      (Split-Path $resolvedRoot -Leaf) -notmatch '^shoreline-installer-[a-f0-9]{32}$') {
    throw 'Unexpected test installation cleanup path'
  }
  Remove-Item -LiteralPath $resolvedRoot -Recurse -Force
}
