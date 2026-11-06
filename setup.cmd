@echo off
rem 한글이 깨지지 않도록 UTF-8 코드페이지로 바꾼 뒤 설치 마법사를 실행한다.
chcp 65001 >nul
node "%~dp0setup.mjs" %*
pause
