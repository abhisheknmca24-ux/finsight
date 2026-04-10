@echo off
echo ===================================================
echo FinSight - Full Stack Dependency Installer
echo ===================================================
echo.

echo [1/3] Installing Backend dependencies...
cd backend
call npm install
cd ..
echo.

echo [2/3] Installing Frontend dependencies...
cd frontend
call npm install
cd ..
echo.

echo [3/3] Installing ML Service dependencies...
cd ml-service
echo Creating Python virtual environment...
python -m venv venv
call venv\Scripts\activate.bat
echo Installing pip requirements...
pip install -r requirements.txt
cd ..
echo.

echo ===================================================
echo Registration Complete! All packages installed successfully.
echo Please review README.md for instructions on how to start the servers.
echo ===================================================
pause
