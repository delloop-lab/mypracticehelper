@echo off
REM Change to project directory
cd /d "%~dp0"

echo ========================================
echo Configure Login Credentials
echo ========================================
echo.
echo Enter your login credentials for the screenshot script:
echo.

set /p LOGIN_EMAIL="Email address: "
set /p LOGIN_PASSWORD="Password: "

echo.
echo Setting environment variables...
echo.

REM Set environment variables for this session
setx LOGIN_EMAIL "%LOGIN_EMAIL%"
setx LOGIN_PASSWORD "%LOGIN_PASSWORD%"

echo.
echo ========================================
echo Configuration Saved!
echo ========================================
echo.
echo Email: %LOGIN_EMAIL%
echo Password: ********
echo.
echo Configuration saved for future use
echo.
echo Note: You may need to close and reopen your terminal for changes to take effect.
echo.
pause
