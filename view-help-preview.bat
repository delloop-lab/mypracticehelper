@echo off
REM Change to project directory
cd /d "%~dp0"
echo ========================================
echo Opening Help Preview
echo ========================================
echo.

REM Check if help-standalone.html exists (preferred - contains all content)
if exist "help-standalone.html" (
    echo Found help-standalone.html - using standalone version (no JSON file needed)
    echo.
    echo Opening help-standalone.html in your default browser...
    echo.
    echo Note: If screenshots are in help-screenshots/, they will be displayed automatically.
    echo.
    start "" "help-standalone.html"
    goto :end
)

REM Fallback to help-preview.html if standalone doesn't exist
if exist "help-preview.html" (
    echo Found help-preview.html - requires help-content.json
    echo.
    if not exist "help-content.json" (
        echo [WARNING] help-content.json not found!
        echo help-preview.html needs help-content.json to work.
        echo.
        echo Generating standalone version...
        node scripts/generate-standalone-help.js
        if exist "help-standalone.html" (
            echo Opening help-standalone.html instead...
            start "" "help-standalone.html"
            goto :end
        )
    )
    echo Opening help-preview.html in your default browser...
    echo.
    start "" "help-preview.html"
    goto :end
)

echo [ERROR] Neither help-standalone.html nor help-preview.html found!
echo.
pause
exit /b 1

:end

echo.
echo The help preview should now be open in your browser.
echo.
echo If screenshots don't appear:
echo   1. Make sure you've run the screenshot capture script first
echo   2. Check that screenshots are in the help-screenshots/ folder
echo   3. Try opening help-preview.html from the public/ folder instead
echo.
pause
