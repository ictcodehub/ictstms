@echo off
title Running ICT CodeHub Mobile Server
echo Switching to the project directory...
cd /d "C:\Project\ictstms"

echo.
echo ========================================================
echo  MOBILE ACCESS INFORMATION
echo  On your HP/Mobile, connect to the same Wi-Fi.
echo  Try creating a connection to one of these IP addresses:
echo ========================================================
ipconfig | findstr /i "IPv4"
echo ========================================================
echo.
echo Make sure you have opened Port 5173 in Firewall!
echo Press any key to start the server...
pause

echo.
echo Starting Server...
npm run dev

pause
