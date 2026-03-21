@echo off
setlocal
set "ROOT=%~dp0.."
set "PYTHON=Y:\conda\envs\mkdocs\python.exe"

if not exist "%PYTHON%" exit /b 1

cd /d "%ROOT%"
"%PYTHON%" -m mkdocs build --clean
if errorlevel 1 exit /b %errorlevel%

"%PYTHON%" "%ROOT%\tools\project_launcher.py"
