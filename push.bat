@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .git (
  git init
  git branch -M main
  git remote add origin git@github.com:mosamadamepo/KouzFab.git
)
git add -A
git commit -m "update %date% %time%"
git push -u origin main
echo.
echo === push finished. GitHub Pages will refresh in a minute or two. ===
pause
