@echo off
cd /d "%~dp0"
node "simple-scene\start-preview.mjs" "%~1"
if errorlevel 1 pause
