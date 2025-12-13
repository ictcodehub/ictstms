@echo off
echo Mencari Android studio...

set "TARGET_EXE=C:\Program Files\Android\Android Studio\bin\studio64.exe"
set "PROJECT_PATH=%~dp0android"

echo Target EXE: "%TARGET_EXE%"
echo Project Path: "%PROJECT_PATH%"

if exist "%TARGET_EXE%" (
    echo Ditemukan! Membuka Android Studio...
    echo.
    echo Mohon tunggu sebentar, Android Studio sedang loading...
    start "" "%TARGET_EXE%" "%PROJECT_PATH%"
    
    echo.
    echo Perintah sukses dikirim. Jendela Android Studio akan muncul segera.
    timeout /t 5
    exit
) else (
    echo [ERROR] File tidak ditemukan di: "%TARGET_EXE%"
)

echo.
echo Mencoba pencarian manual...
where /r "C:\Program Files" studio64.exe
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Silakan copy path di atas dan buka manual.
)

pause
