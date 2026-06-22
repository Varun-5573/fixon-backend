Copy-Item -Path "worker_app\build\app\outputs\flutter-apk\app-release.apk" -Destination "FixoN_Worker_App.apk" -Force

do {
  $out = adb devices
  if ($out -match '10BDC70RAM000BQ\s+device') {
    Write-Host "Device Authorized! Installing updated Worker App APK..."
    adb -s 10BDC70RAM000BQ install -r FixoN_Worker_App.apk
    Write-Host "Worker App Installation complete!"
    break
  } else {
    Write-Host "Waiting for device 10BDC70RAM000BQ to connect..."
  }
  Start-Sleep -Seconds 3
} while ($true)
