@echo off
title MyNest - Start Servers
cd /d "%~dp0"

echo ==========================================
echo   MyNest  -  starting backend + frontend
echo ==========================================
echo.

echo [1/3] Stopping old servers (ports 5000 + 5173 only)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":5000 .*LISTENING"') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":5173 .*LISTENING"') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Starting backend  (API on http://localhost:5000)
start "MyNest API" cmd /k "cd /d server && node index.js"

echo [3/3] Starting frontend (site on http://localhost:5173)
start "MyNest Frontend" cmd /k "cd /d client && npm run dev"

echo.
echo Both servers starting...
echo   Website: http://localhost:5173
echo   API:     http://localhost:5000/api/health
echo.
echo Do NOT close the two new windows - they run the servers.
echo Close them to stop the servers.
timeout /t 5 /nobreak >nul
