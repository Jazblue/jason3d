param(
  [string]$Owner = "jazblue",
  [string]$Repository = "jason3d"
)

$ErrorActionPreference = "Stop"
$repoRoot = Join-Path $PSScriptRoot "jason3d"
$fullName = "$Owner/$Repository"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI is required. Install it, then run this script again."
}

if (-not (Test-Path (Join-Path $repoRoot ".git"))) {
  throw "Prepared git repository not found at $repoRoot"
}

$credentialInput = "protocol=https`nhost=github.com`n`n"
$credential = ($credentialInput | git credential fill 2>$null | Out-String)
$tokenMatch = [regex]::Match($credential, "(?m)^password=(.+)$")
if (-not $tokenMatch.Success) {
  throw "No GitHub credential found. Run: gh auth login -h github.com"
}

$env:GITHUB_TOKEN = $null
$env:GH_TOKEN = $tokenMatch.Groups[1].Value.Trim()

& gh auth status
$repoExists = & gh repo view $fullName --json name 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Creating $fullName..."
  & gh repo create $fullName --public --description "Jason 3D website"
}

Write-Host "Pushing main..."
& git -C $repoRoot push -u origin main

Write-Host "Requesting GitHub Pages deployment..."
& gh api --method POST "repos/$fullName/pages" -f "source[branch]=main" -f "source[path]=/" 2>$null | Out-Null

Write-Host "Done. Open https://$Owner.github.io/$Repository/"
