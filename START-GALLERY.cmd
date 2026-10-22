@echo off
setlocal
set "WE=C:\Program Files (x86)\Steam\steamapps\common\wallpaper_engine\wallpaper64.exe"
if not exist "%WE%" (
  echo Wallpaper Engine was not found in the default Steam folder.
  echo Copy this folder to wallpaper_engine\projects\myprojects\classical-gallery.
  pause
  exit /b 1
)
tasklist /FI "IMAGENAME eq wallpaper64.exe" /NH | find /I "wallpaper64.exe" >nul
if errorlevel 1 (
  tasklist /FI "IMAGENAME eq wallpaper32.exe" /NH | find /I "wallpaper32.exe" >nul
  if errorlevel 1 (
    start "" "%WE%" -silent
    timeout /t 8 /nobreak >nul
  )
)
start "" "%WE%" -control openWallpaper -file "%~dp0project.json"
endlocal
