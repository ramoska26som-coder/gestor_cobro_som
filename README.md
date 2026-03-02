# 📋 Cobros App - Sistema de Gestión de Cobros

Sistema completo para gestores de cobro de préstamos personales.
Conecta con Google Sheets como base de datos via Google Apps Script.

## 🚀 Instalación Paso a Paso

### PASO 1: Preparar Google Sheets

Tu spreadsheet debe tener estas hojas (con estos nombres exactos):

**Hoja "Prestamos"** (la que ya exportás del sistema):
| A  | B       | C    | D     | E       | F       | G              | H         | I       |
|----|---------|------|-------|---------|---------|----------------|-----------|---------|
| #  | Cliente | Tipo | Fecha | Capital | Balance | Balance Cuotas | Día(s) Pago | Cartera |

**Hoja "Pagos"** (también del sistema):
| A  | B       | C    | D     | E     | F          | G    | H       | I       |
|----|---------|------|-------|-------|------------|------|---------|---------|
| #  | Cliente | Tipo | Valor | Fecha | Registrado | Caja | Cartera | Usuario |

**Hoja "Gestiones"** → Se crea automáticamente al ejecutar la app.

### PASO 2: Configurar Apps Script (Backend)

1. Abrí tu Google Sheet
2. Ir a **Extensiones → Apps Script**
3. Borrá todo el contenido existente
4. Copiá y pegá todo el contenido del archivo `Code.gs`
5. Guardá (Ctrl+S)

### PASO 3: Publicar como Web App

1. En Apps Script, click en **Implementar → Nueva implementación**
2. Click en el engranaje ⚙️ y seleccioná **Aplicación web**
3. Configurar:
   - **Descripción**: Cobros App API
   - **Ejecutar como**: Yo
   - **Quién tiene acceso**: Cualquier persona
4. Click **Implementar**
5. **Copiá la URL** que te genera (algo como: `https://script.google.com/macros/s/ABC123.../exec`)

### PASO 4: Configurar el Frontend

1. Abrí el archivo `js/config.js`
2. Reemplazá `TU_ID_AQUI` con tu URL de Apps Script:
```javascript
API_URL: 'https://script.google.com/macros/s/TU_URL_COMPLETA/exec',
```
3. Cambiá el nombre del gestor si querés:
```javascript
GESTOR_NOMBRE: 'Juan Pérez',
```

### PASO 5: Subir a GitHub Pages

```bash
# Crear repositorio
git init
git add .
git commit -m "Cobros App v1.0"

# Subir a GitHub
git remote add origin https://github.com/TU_USUARIO/cobros-app.git
git push -u origin main

# Activar GitHub Pages:
# Settings → Pages → Source: main → /(root) → Save
```

Tu app estará en: `https://TU_USUARIO.github.io/cobros-app/`

---

## 📱 Funcionalidades

### Dashboard
- Cartera total y cuotas pendientes
- Monto recuperado del ciclo (cierre día 8)
- Progreso de gestiones del día
- Contador de días para cierre
- Alertas de promesas vencidas

### Cartera
- Lista completa de clientes activos (Balance + Cuotas ≥ L5)
- Filtros por: nombre, día de semana, día del mes, estado de gestión
- Ordenar por: balance, cuota, nombre
- Botón de WhatsApp directo
- Botón de gestionar

### Gestión Hoy
- Clientes programados para hoy (según su día de pago)
- Separados en: pendientes y gestionados
- Gestión rápida desde la lista

### Historial
- Todas las gestiones registradas
- Filtros por fecha y estado
- Historial completo por cliente

### Pagos
- Pagos registrados del sistema
- Búsqueda por cliente
- Total acumulado

### Modal de Gestión
- Ver préstamos activos del cliente
- Seleccionar estado (Pagado, Promesa, No Contesta, etc.)
- Agregar comentario y fecha de promesa
- Ver historial de gestiones previas
- Guarda automáticamente en Google Sheets

---

## 📂 Estructura de Archivos

```
cobros-app/
├── index.html          ← Página principal
├── manifest.json       ← Config PWA
├── sw.js              ← Service Worker (offline)
├── Code.gs            ← Backend (pegar en Apps Script)
├── css/
│   └── styles.css     ← Estilos completos
├── js/
│   ├── config.js      ← ⚡ CONFIGURAR URL AQUÍ
│   ├── api.js         ← Conexión con Apps Script
│   └── app.js         ← Lógica de la aplicación
└── README.md          ← Este archivo
```

---

## ⚠️ Notas Importantes

- **Primera vez**: Al abrir la app, si no está configurada la URL, cargará datos de ejemplo
- **Actualizar datos**: Click en 🔄 para recargar desde Google Sheets
- **Cada vez que reimportes datos** del sistema a las hojas Prestamos/Pagos, solo dale 🔄 en la app
- **Los gestiones se guardan** automáticamente en la hoja "Gestiones" de Sheets
- **Las filas se colorean** según el estado (verde=pagado, amarillo=promesa, etc.)
- **Compatible con móvil**: Diseñado mobile-first, se puede instalar como app

---

## 🔧 Personalización

### Cambiar día de cierre
En `js/config.js`: `DIA_CIERRE: 8` → cambiar al día que necesités

### Agregar más estados
En `js/config.js`, agregar al array `ESTADOS`

### Múltiples gestores
Cambiá `GESTOR_NOMBRE` por gestor, o implementá login simple

### Agregar columna de teléfono
Si tu hoja Prestamos tiene columna de teléfono, ajustá el índice en Code.gs
