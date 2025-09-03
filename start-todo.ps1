# Script de inicio para TODO-Fullstack
# Compila el frontend y levanta el servidor único en http://localhost:4000

Write-Host "=== Iniciando TODO-Fullstack ===" -ForegroundColor Cyan

# Ir a la carpeta raíz
Set-Location "C:\Users\Leandro\Documents\todo-fullstack"

# Compilar frontend
Write-Host ">>> Compilando frontend..." -ForegroundColor Yellow
npm run build

# Levantar backend (queda corriendo hasta que cierres la ventana)
Write-Host ">>> Levantando servidor en http://localhost:4000" -ForegroundColor Green
npm run server
