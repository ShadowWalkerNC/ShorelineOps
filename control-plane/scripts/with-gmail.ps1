param(
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$NodeArguments
)
$ErrorActionPreference = 'Stop'
if (!$NodeArguments.Count) { throw 'Provide a Node script and its arguments. Credentials are passed only to that child process.' }
$bundlePath = Join-Path $env:LOCALAPPDATA 'ShorelineOps-control\gmail-oauth.xml'
$secure = Import-Clixml -LiteralPath $bundlePath
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$names = @('GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_SENDER')
$previous = @{}
try {
  $configuration = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) | ConvertFrom-Json
  foreach ($name in $names) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    $value = $configuration.$name
    if (!$value) { throw 'The encrypted Gmail bundle is incomplete.' }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
  & node @NodeArguments
  $result = $LASTEXITCODE
} finally {
  foreach ($name in $previous.Keys) {
    [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
  }
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  $configuration = $null
}
exit $result
