@echo off
cd /d "%~dp0"
node visual-editor\launch-editor.mjs
if errorlevel 1 pause
