@echo off
title Tataheer ERP 2026
color 4F
echo.
echo  ████████╗ █████╗ ████████╗ █████╗ ██╗  ██╗███████╗███████╗██████╗
echo     ██╔══╝██╔══██╗╚══██╔══╝██╔══██╗██║  ██║██╔════╝██╔════╝██╔══██╗
echo     ██║   ███████║   ██║   ███████║███████║█████╗  █████╗  ██████╔╝
echo     ██║   ██╔══██║   ██║   ██╔══██║██╔══██║██╔══╝  ██╔══╝  ██╔══██╗
echo     ██║   ██║  ██║   ██║   ██║  ██║██║  ██║███████╗███████╗██║  ██║
echo     ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝
echo.
echo  TATAHEER TRADERS — Enterprise Resource Planning System 2026
echo  426- Ali Arcade, 13-km Main Multan Road, Lahore
echo  +92(314)4094900
echo.
echo  Starting ERP Server...
echo.

cd /d "%~dp0"

:: Check if node_modules exists
if not exist "node_modules\" (
    echo  [!] First run detected. Installing dependencies...
    echo      This may take 2-3 minutes. Please wait...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo  [ERROR] Failed to install dependencies.
        echo  Please ensure Node.js is installed: https://nodejs.org
        pause
        exit /b 1
    )
    echo.
    echo  [OK] Dependencies installed successfully!
    echo.
)

echo  [OK] Starting API server on port 5000...
echo  [OK] Starting UI server (browser will open automatically)...
echo.
echo  Press Ctrl+C to stop all servers.
echo.

call npm run dev:full

pause
