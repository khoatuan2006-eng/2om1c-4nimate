param([Parameter(Mandatory=$true)][string]$Base,[Parameter(Mandatory=$true)][string]$ExportId,[Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference='Stop'
$qaSamples=[System.Collections.Generic.List[object]]::new()
for($qaIndex=0;$qaIndex -lt 1200;$qaIndex++) {
  try {
    $qaJob=Invoke-RestMethod "$Base/api/exports/$ExportId" -TimeoutSec 15
    $qaTree=@(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CreationDate,CommandLine)
    $qaPids=[System.Collections.Generic.HashSet[int]]::new()
    $qaOwner=$qaTree | Where-Object { $_.ProcessId -eq $qaJob.workerPid -and $_.CommandLine -like "*export-worker.mjs*$ExportId*" }
    if($qaOwner) { [void]$qaPids.Add([int]$qaOwner.ProcessId) }
    do { $qaAdded=$false;foreach($qaNode in $qaTree) { if($qaPids.Contains([int]$qaNode.ParentProcessId) -and $qaPids.Add([int]$qaNode.ProcessId)) { $qaAdded=$true } } } while($qaAdded)
    $qaStats=@($qaPids | ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue } | Select-Object Id,ProcessName,CPU,WorkingSet64,PrivateMemorySize64)
    $qaSamples.Add([pscustomobject]@{at=[DateTime]::UtcNow.ToString('o');status=$qaJob.status;progress=$qaJob.progress;processes=$qaStats})
    [System.IO.File]::WriteAllText($Output,($qaSamples | ConvertTo-Json -Depth 5),[System.Text.UTF8Encoding]::new($false))
    if($qaJob.status -in @('complete','failed','cancelled')) { $qaJob | Select-Object id,status,progress,error,createdAt,completedAt | ConvertTo-Json -Compress;exit 0 }
  } catch {
    $qaSamples.Add([pscustomobject]@{at=[DateTime]::UtcNow.ToString('o');observationError=$_.Exception.Message})
    [System.IO.File]::WriteAllText($Output,($qaSamples | ConvertTo-Json -Depth 5),[System.Text.UTF8Encoding]::new($false))
  }
  Start-Sleep -Seconds 3
}
Write-Output 'Observation window expired; inspect the same export ID before deciding whether it has stopped.'
