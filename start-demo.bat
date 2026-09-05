@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  if exist "%LOCALAPPDATA%\Temp\opencode\node\node.exe" (
    set "NODE=%LOCALAPPDATA%\Temp\opencode\node\node.exe"
  ) else (
    echo [ERR] 未找到 node。请先安装 Node.js 18+ 并加入 PATH。
    pause
    exit /b 1
  )
) else (
  set "NODE=node"
)

echo [1/3] 确保 public\data 有基础数据...
"%NODE%" scripts\copy-public-data.js
if errorlevel 1 (
  echo [ERR] copy-public-data 失败。若无 data\processed，请先 npm run build
  pause
  exit /b 1
)

echo [2/3] 接入多区域数据包...
"%NODE%" scripts\copy-regional-delivery.js
if errorlevel 1 (
  echo [WARN] regional-data-delivery 未接入，主应用仍可使用陆家嘴案例。
)

echo [3/3] 启动 http://127.0.0.1:4173 ...
start "" "http://127.0.0.1:4173/"
"%NODE%" "%~dp0scripts\serve-static.js" "%~dp0public" 4173
pause
