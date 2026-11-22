@echo off
cd /d "%~dp0"
echo Dong editor truoc khi phuc hoi. Mo http://127.0.0.1:3024
node visual-editor\recovery-server.mjs
if errorlevel 1 pause
