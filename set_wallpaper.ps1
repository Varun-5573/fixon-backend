Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Wallpaper {
    [DllImport("user32.dll", CharSet=CharSet.Auto)]
    public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
"@
$wallpaperPath = "c:\Users\pitta\Desktop\FixoN\FixoN_Wallpaper.png"
[Wallpaper]::SystemParametersInfo(20, 0, $wallpaperPath, 3)
Write-Host "✅ FixoN Wallpaper set successfully!"
