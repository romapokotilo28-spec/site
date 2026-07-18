# Локальный сервер для теста (SDK подключится только на платформе Яндекс Игр)
$port = 8080
$root = $PSScriptRoot
Write-Host "Сервер: http://localhost:$port"
Write-Host "Откройте index.html через этот адрес"
python -m http.server $port --directory $root
