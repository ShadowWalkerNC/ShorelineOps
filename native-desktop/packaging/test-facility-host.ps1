param(
    [Parameter(Mandatory)]
    [string]$Executable
)

$ErrorActionPreference = 'Stop'
$hostPath = (Get-Command $Executable -CommandType Application).Source
$testData = Join-Path ([IO.Path]::GetTempPath()) ("shoreline-package-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $testData | Out-Null

function Assert-HostStatus([bool]$Initialized) {
    $hostLog = Join-Path $testData "host-$Initialized.log"
    $launch = @{
        FilePath = $hostPath
        ArgumentList = ('--data-dir "{0}" --port 0' -f $testData)
        RedirectStandardOutput = $hostLog
        PassThru = $true
    }
    if ($IsWindows) { $launch.WindowStyle = 'Hidden' }
    $process = Start-Process @launch
    try {
        for ($attempt = 0; $attempt -lt 50; $attempt++) {
            if ($process.HasExited) { throw 'Facility host exited during startup' }
            $output = Get-Content -LiteralPath $hostLog -Raw
            if ($output -match 'http://127\.0\.0\.1:\d+/api/v1') {
                $api = $Matches[0]
                $health = Invoke-RestMethod "$api/health" -TimeoutSec 5
                $setup = Invoke-RestMethod "$api/setup" -TimeoutSec 5
                if ($health.status -ne 'ok' -or $health.api_version -ne 1) {
                    throw 'Unexpected facility health response'
                }
                if ($setup.facility_initialized -ne $Initialized) {
                    throw 'Unexpected facility setup status'
                }
                return
            }
            Start-Sleep -Milliseconds 100
        }
        throw 'No facility endpoint reported'
    } finally {
        if (!$process.HasExited) { Stop-Process -InputObject $process }
        $process.WaitForExit()
    }
}

Assert-HostStatus $false
& $hostPath --data-dir $testData --initialize-facility 'Package Test Facility'
if ($LASTEXITCODE -ne 0) { throw 'Facility initialization failed' }
Assert-HostStatus $true
Write-Output 'Packaged host health, setup and restart verified.'
