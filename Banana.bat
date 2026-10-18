@echo off
rem Banana.bat - doppio clic per avviare Banana su Windows
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0scripts\banana_launcher.ps1"
