@echo off
setlocal
cd /d "%~dp0"

echo Checking portfolio data changes...
git status --porcelain -- data/portfolio.json > "%TEMP%\spine_portfolio_status.txt"

for %%A in ("%TEMP%\spine_portfolio_status.txt") do (
    if %%~zA==0 (
        echo.
        echo No data changes to publish.
        echo.
        pause
        exit /b 0
    )
)

echo.
echo Publishing data/portfolio.json...
git add data/portfolio.json
git commit -m "Update portfolio data"
if errorlevel 1 (
    echo.
    echo Commit failed. Check the message above.
    echo.
    pause
    exit /b 1
)

git push
if errorlevel 1 (
    echo.
    echo Push failed. Check the message above.
    echo.
    pause
    exit /b 1
)

echo.
echo Published. GitHub Pages will update shortly.
echo.
pause
