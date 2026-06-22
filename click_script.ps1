
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class NonAdminClick {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);
    public static void ClickAt(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(300);
        // Click 1 (focus)
        mouse_event(0x02, 0, 0, 0, 0);
        System.Threading.Thread.Sleep(100);
        mouse_event(0x04, 0, 0, 0, 0);
        System.Threading.Thread.Sleep(500);
        // Click 2 (trigger button)
        mouse_event(0x02, 0, 0, 0, 0);
        System.Threading.Thread.Sleep(100);
        mouse_event(0x04, 0, 0, 0, 0);
    }
}
"@

try {
    $proc = Get-Process -Name chrome | Where-Object { $_.MainWindowTitle -like "*Clusters*" } | Select-Object -First 1
    if (-not $proc) {
        $proc = Get-Process -Name chrome | Where-Object { $_.MainWindowTitle -like "*Chrome*" } | Select-Object -First 1
    }
    
    if ($proc) {
        [NonAdminClick]::SetForegroundWindow($proc.MainWindowHandle)
        Start-Sleep -Milliseconds 800
        
        # Click Connect button at calibrated logical x=561, y=389
        [NonAdminClick]::ClickAt(561, 389)
        "Clicked Chrome window successfully!" | Out-File "C:\Users\pitta\Desktop\FixoN\non_admin_out.txt"
    } else {
        "Chrome process not found!" | Out-File "C:\Users\pitta\Desktop\FixoN\non_admin_out.txt"
    }
} catch {
    $_ | Out-File "C:\Users\pitta\Desktop\FixoN\non_admin_out.txt"
}
