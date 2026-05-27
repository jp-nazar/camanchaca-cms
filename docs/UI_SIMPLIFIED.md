# UI Simplified Mode

Cuando la variable de entorno `UI_SIMPLIFIED=true` está activa, la interfaz se simplifica ocultando funcionalidades avanzadas y deshabilitando ciertas opciones.

## Configuración

Agregar al archivo `server/.env`:

```env
UI_SIMPLIFIED=true
```

Reiniciar el servidor para aplicar cambios.

## Características Ocultas

### Panel de Administración

| Feature | Comportamiento | Archivo |
|---------|---------------|---------|
| **Descargar respaldo de BD** | Botón oculto | `frontend/js/views/admin.js` |

### Configuración (Settings)

| Feature | Comportamiento | Archivo |
|---------|---------------|---------|
| **Exportar mis datos** | Botón oculto | `frontend/js/views/settings.js` |
| **Importar datos** | Botón oculto | `frontend/js/views/settings.js` |
| **Alertas por email** | Checkbox oculto | `frontend/js/views/settings.js` |

### Informes (Reports)

| Feature | Comportamiento | Archivo |
|---------|---------------|---------|
| **Exportar CSV** | Botón oculto | `frontend/js/views/reports.js` |

### Sidebar - Elementos Ocultos

| Feature | Comportamiento | Archivo |
|---------|---------------|---------|
| **Muros de video** | Link oculto | `frontend/js/app.js` |
| **Actividad** | Link oculto | `frontend/js/app.js` |
| **Ayuda** | Link oculto | `frontend/js/app.js` |

### Sidebar - Elementos Deshabilitados

| Feature | Comportamiento | Archivo |
|---------|---------------|---------|
| **Integraciones** | Link visible pero deshabilitado (opacidad reducida, no responde a clicks) | `frontend/js/app.js`, `frontend/css/main.css` |

## Redirecciones Automáticas

Cuando `UI_SIMPLIFIED=true`, el usuario es redirigido automáticamente al Dashboard si intenta acceder directamente a las siguientes rutas:

- `#/walls`
- `#/wall/:id`
- `#/activity`
- `#/help`
- `#/integrations`

## Implementación Técnica

### Backend

El flag se lee desde `process.env.UI_SIMPLIFIED` en `server/config.js`:

```javascript
uiSimplified: ['true', '1'].includes(String(process.env.UI_SIMPLIFIED || '').toLowerCase()),
```

Y se expone al frontend vía el endpoint `/api/config/ui` en `server/server.js`.

### Frontend

La configuración se obtiene en `frontend/js/app.js` mediante `fetchUiConfig()` y se almacena en la variable global `uiSimplified`. Las vistas reciben este flag como parámetro `opts.uiSimplified`.

```javascript
// Ejemplo de uso en una vista
export async function render(container, opts = {}) {
  container.innerHTML = `
    ${opts.uiSimplified ? '' : `
      <button class="btn btn-primary">Función avanzada</button>
    `}
  `;
}
```

## Archivos Modificados

- `server/config.js` - Lectura de la variable de entorno
- `server/server.js` - Endpoint `/api/config/ui`
- `frontend/js/app.js` - Aplicación del modo simplificado
- `frontend/css/main.css` - Estilos para elementos deshabilitados
- `frontend/js/views/admin.js` - Ocultar backup
- `frontend/js/views/settings.js` - Ocultar export/import y email alerts
- `frontend/js/views/reports.js` - Ocultar exportar CSV
- `frontend/js/views/device-detail.js` - Recibe `uiSimplified` (uso futuro)
