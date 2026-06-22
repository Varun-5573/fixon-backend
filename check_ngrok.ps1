try {
    $tunnels = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -UseBasicParsing
    foreach ($t in $tunnels.tunnels) {
        Write-Output "Public URL: $($t.public_url)"
    }
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}
