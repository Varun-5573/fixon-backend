try {
    $headers = @{
        'ngrok-skip-browser-warning' = 'true'
    }
    $r = Invoke-WebRequest -Uri 'https://glinda-uncataloged-preconfusedly.ngrok-free.dev/api/services' -Headers $headers -TimeoutSec 10 -UseBasicParsing
    Write-Output "Status: $($r.StatusCode)"
    Write-Output "Content:"
    Write-Output $r.Content
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}
