@echo off
title FixoN - Starting All Services
color 0A
cls

echo.
echo  ███████╗██╗██╗  ██╗ ██████╗ ███╗   ██╗
echo  ██╔════╝██║╚██╗██╔╝██╔═══██╗████╗  ██║
echo  █████╗  ██║ ╚███╔╝ ██║   ██║██╔██╗ ██║
echo  ██╔══╝  ██║ ██╔██╗ ██║   ██║██║╚██╗██║
echo  ██║     ██║██╔╝ ██╗╚██████╔╝██║ ╚████║
echo  ╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
echo.
echo  == Admin Control Panel Launcher ==
echo.

echo [1/2] Starting Backend Server...
start "FixoN Backend" cmd /k "cd /d "C:\Users\pitta\Desktop\FixoN" && echo Starting FixoN Backend... && npm start"

timeout /t 4 /nobreak > nul

echo [2/2] Starting Admin Panel...
start "FixoN Admin Panel" cmd /k "cd /d "C:\Users\pitta\Desktop\FixoN" && echo Starting FixoN Admin Panel... && npm run dev:admin"

timeout /t 5 /nobreak > nul

echo.
echo  ✅ All services starting!
echo  🌐 Admin Panel: http://localhost:3000
echo  🔌 Backend API: http://localhost:5000
echo  📧 Login: admin@servixo.com
echo  🔑 Password: Admin@123
echo.
echo  Opening browser...
start "" "http://localhost:3000"

timeout /t 3 /nobreak > nul
exit
