@echo off
cd /d D:\sites\mealplanix
echo Starting mealplanix...
pnpm dev --open
echo.
echo === Server stopped. Press any key to close. ===
pause > nul
