# Guía de Usuario — Camanchaca CMS

Manual para usuarios del dashboard. Cómo usar el sistema para gestionar pantallas, contenido y usuarios.

---

## 1. Conceptos Básicos

### ¿Qué es un Workspace?

Un **workspace** es un espacio de trabajo independiente que contiene sus propios recursos: pantallas, contenido, playlists, widgets y miembros. Piensa en ello como una "carpeta" donde todo lo que creas está aislado de otros workspaces.

**Ejemplo práctico:**
- **Workspace "Planta Santiago"** → Contiene las pantallas de la planta de Santiago, sus videos de seguridad, y los operadores locales.
- **Workspace "Planta Puerto Montt"** → Contiene las pantallas de Puerto Montt, su contenido específico, y su equipo local.

**Regla de oro:** Los recursos no se comparten entre workspaces. Una pantalla en "Planta Santiago" no puede reproducir contenido del workspace "Planta Puerto Montt".

### Multitenancy (Multi-organización)

El sistema permite que múltiples organizaciones coexistan, cada una con sus propios workspaces y usuarios. Como usuario normal, no necesitas preocuparte por esto — tu admin te asignará al workspace correcto.

---

## 2. Roles y Permisos

Tu rol determina qué puedes hacer en el sistema. De más poder a menos poder:

| Rol | ¿Qué puedo hacer? |
|-----|-------------------|
| **Platform Admin** | Todo: crear workspaces, usuarios, ver todo el sistema |
| **Org Owner** | Administrar su organización y todos los workspaces dentro de ella |
| **Org Admin** | Administrar workspaces (sin acceso a billing) |
| **Workspace Admin** | Administrar miembros, renombrar workspace, full control dentro de su workspace |
| **Workspace Editor** | Crear/editar contenido, playlists, pantallas. **No** puede agregar/quitar usuarios |
| **Workspace Viewer** | Solo ver contenido y estado de pantallas. **No** puede editar nada |

**Nota:** La mayoría de los usuarios operativos serán **Workspace Editor** (pueden subir contenido y crear playlists) o **Workspace Viewer** (solo monitorean).

---

## 3. Cambiar de Workspace

Si perteneces a múltiples workspaces, verás un **selector en la barra lateral**.

**Para cambiar:**
1. Haz clic en el nombre del workspace actual (arriba en la barra lateral).
2. Selecciona otro workspace de la lista.
3. La página se recargará automáticamente con el nuevo contexto.

**Importante:** Todo lo que veas (pantallas, contenido, playlists) cambiará según el workspace seleccionado. No hay "vista global" — siempre estás dentro de un workspace específico.

---

## 4. Gestión de Usuarios (Solo Admins)

### Crear un usuario nuevo

1. Ve a **"Admin"** en el menú lateral.
2. Haz clic en **"Usuarios"**.
3. Presiona **"Crear usuario"**.
4. Completa:
   - **Email:** Dirección de correo del nuevo usuario.
   - **Nombre:** Nombre completo.
   - **Rol:** Selecciona según sus necesidades (ver tabla arriba).
   - **Contraseña:** Temporal. El usuario puede cambiarla después.
5. Guarda.

**El nuevo usuario se asigna automáticamente al workspace actual.**

### Editar o eliminar usuarios

En la misma sección "Usuarios", haz clic en el usuario para editar su rol o nombre. Para eliminar, usa el botón de eliminar (⚠️ irreversible).

---

## 5. Biblioteca de Contenido

La **Biblioteca de contenido** es donde subes y organizas todo el material multimedia.

### Tipos de contenido soportados

- **Videos:** MP4, WebM, AVI, MKV
- **Imágenes:** JPEG, PNG, GIF, WebP
- **URLs remotas:** Enlaces directos a videos o imágenes (streaming sin ocupar espacio local)
- **YouTube:** Videos de YouTube embebidos

### Subir contenido

1. Ve a **"Contenido"** en el menú lateral.
2. Arrastra archivos al área de upload o haz clic para seleccionar.
3. También puedes:
   - Agregar una **URL remota** (streaming directo)
   - Agregar un **video de YouTube**

**Límite:** 500MB por archivo.

### Organizar con carpetas

1. En la Biblioteca de contenido, haz clic en **"+ Nueva carpeta"**.
2. Arrastra archivos a la carpeta para organizarlos.
3. Usa el **breadcrumb** (ruta de navegación) para moverte entre carpetas.

**Nota:** Las carpetas son solo organización visual. No afectan la disponibilidad del contenido en playlists.

---

## 6. Playlists (Listas de Reproducción)

Una **playlist** es una secuencia ordenada de contenido que se reproduce en una o más pantallas.

### Jerarquía: Cómo se anidan las cosas

```
Playlist
├── Item 1: video_de_seguridad.mp4 (30 segundos)
├── Item 2: imagen_kpi.jpg (10 segundos)
├── Item 3: widget_reloj (widget dinámico)
└── Item 4: video_youtube (duración automática)
```

**Cada item tiene:**
- **Contenido:** El archivo, widget o URL.
- **Duración:** Cuántos segundos se muestra (para imágenes y widgets; los videos usan su duración natural).
- **Orden:** Posición en la secuencia (arrastra para reordenar).

### Crear una playlist

1. Ve a **"Playlists"** en el menú lateral.
2. Haz clic en **"+ Nueva lista"**.
3. Asigna un nombre (ej: "Playlist Turno Mañana").
4. Haz clic en **"Editar"** para agregar items.

### Agregar items a una playlist

1. Dentro de la playlist, haz clic en **"Agregar item"**.
2. Selecciona de tu Biblioteca de contenido:
   - Videos
   - Imágenes
   - Widgets (reloj, clima, texto, etc.)
3. Ajusta la **duración** si es necesario (solo para imágenes/widgets).
4. Arrastra los items para cambiar el orden.

### Asignar playlist a una pantalla

1. Ve a **"Displays"** en el menú lateral.
2. Haz clic en la pantalla que quieres configurar.
3. En el panel de detalle, selecciona la **Playlist** deseada.
4. Guarda los cambios.

La pantalla recibirá la actualización en tiempo real (si está online) o la próxima vez que se conecte.

---

## 7. Pantallas (Displays)

### Emparejar una pantalla nueva

1. En la pantalla física (TV, tablet, etc.), abre el **Web Player** (`https://tu-servidor/player`) o la **app Android**.
2. La pantalla mostrará un **código de 6 dígitos**.
3. En el dashboard, ve a **"Displays"** → **"Agregar Display"**.
4. Ingresa el código y asigna un nombre (ej: "TV Vestíbulo").
5. La pantalla se emparejará automáticamente.

### Estado de una pantalla

En la lista de Displays verás:
- **🟢 Online:** Conectada y funcionando.
- **🔴 Offline:** Sin conexión. Último heartbeat hace más de 45 segundos.
- **🟡 Emparejando:** Mostrando código de emparejamiento.

### Acciones remotas

Haz clic en una pantalla para:
- **Ver screenshot:** Captura de pantalla en tiempo real.
- **Cambiar playlist:** Asignar contenido diferente.
- **Reiniciar:** Reiniciar el player remotamente.
- **Apagar/Encender:** Control de energía (solo Android TV con permisos).

---

## 8. Layouts (Diseños de Pantalla)

Los **layouts** permiten dividir la pantalla en **zonas** para mostrar múltiples contenidos simultáneamente.

### Plantillas disponibles

- **Fullscreen:** Un solo contenido a pantalla completa.
- **Split Horizontal:** Dos zonas, izquierda y derecha.
- **Split Vertical:** Dos zonas, arriba y abajo.
- **L-Bar:** Contenido principal + barra lateral + ticker inferior.
- **Picture in Picture:** Video de fondo + ventana pequeña superpuesta.
- **Three Column:** Tres columnas verticales.
- **Four Quadrants:** Cuatro cuadrantes.

### Asignar layout a una pantalla

1. Ve a **"Displays"** y selecciona una pantalla.
2. En el panel de detalle, selecciona **Layout**.
3. Elige una plantilla.
4. Asigna contenido a cada zona de la plantilla.

---

## 9. Widgets

Los **widgets** son contenido dinámico que se actualiza automáticamente.

### Tipos de widgets

- **Reloj:** Hora actual con formato configurable.
- **Clima:** Pronóstico del tiempo (requiere configurar ubicación).
- **Texto/HTML:** Mensajes personalizados con formato HTML.
- **RSS Ticker:** Noticias de una fuente RSS.
- **Página web:** Mostrar una página web completa.
- **Directorio:** Lista de departamentos/personas (ideal para vestíbulos).

### Crear un widget

1. Ve a **"Widgets"** en el menú lateral.
2. Haz clic en **"+ Nuevo widget"**.
3. Selecciona el tipo.
4. Configura según el tipo (texto, ubicación para clima, URL para web, etc.).
5. Guarda.

### Usar widgets en playlists

Los widgets se agregan a las playlists como cualquier otro contenido. Dura el tiempo que especifiques (ej: 10 segundos), y se actualiza en cada ciclo.

---

## 10. Scheduling (Programación Horaria)

El **scheduling** permite programar qué contenido se muestra en horarios específicos.

### Casos de uso comunes

- **Turnos:** Playlist de "Turno Día" de 6:00 a 18:00, "Turno Noche" de 18:00 a 6:00.
- **Días especiales:** Contenido especial los viernes o días festivos.
- **Áreas:** Contenido específico por área según el horario.

### Crear un schedule

1. Ve a **"Schedule"** en el menú lateral.
2. Selecciona una **pantalla** o **grupo de pantallas**.
3. Arrastra en el calendario semanal para crear bloques horarios.
4. Asigna una **playlist** a cada bloque.
5. Guarda.

**Prioridad:** Si hay conflictos (dos playlists al mismo tiempo), gana la programación más específica (device-level > group-level).

---

## 11. Grupos de Pantallas

Los **grupos** permiten manejar múltiples pantallas como una sola unidad.

### Crear un grupo

1. Ve a **"Displays"** → pestaña **"Grupos"**.
2. Haz clic en **"+ Nuevo grupo"**.
3. Asigna un nombre (ej: "Pantallas Planta Principal").
4. Agrega pantallas al grupo.

### Acciones en grupo

Una vez creado el grupo, puedes:
- **Asignar playlist a todo el grupo** de una vez.
- **Enviar comandos masivos:** Reiniciar, apagar, encender todas las pantallas del grupo.
- **Programar schedules** para el grupo completo.

---

## 12. Onboarding: Primeros Pasos

Si eres el primer usuario del sistema:

1. **Instalar el servidor** (lo hará el equipo de IT).
2. **Visitar la URL** del servidor (`https://tu-servidor/app`).
3. **Crear cuenta de admin:** Aparecerá automáticamente el formulario de primer usuario.
4. **Onboarding guiado:** El sistema te guiará para:
   - Descargar la app del player (Android o Web).
   - Emparejar tu primera pantalla.
   - Subir contenido de prueba.
   - Crear tu primera playlist.

**Si eres usuario invitado:** Tu admin te creará una cuenta y te asignará a un workspace. Solo recibirás un email con tu login y contraseña temporal.

---

## 13. FAQ

### ¿Puedo compartir una playlist entre workspaces?
**No.** Las playlists son propiedad de un workspace. Si necesitas el mismo contenido en otro workspace, deberás crear la playlist de nuevo ahí.

### ¿Qué pasa si subo un video muy pesado?
El límite es 500MB por archivo. Videos más grandes deberán comprimirse o subirse como URL remota.

### ¿Puedo ver qué muestra una pantalla sin ir físicamente?
**Sí.** En "Displays", haz clic en una pantalla online y selecciona "Screenshot" para ver una captura en tiempo real.

### ¿Qué pasa si una pantalla pierde internet?
El **Service Worker** del player cachea el contenido. La pantalla seguirá reproduciendo lo que ya tenía descargado. Cuando vuelva la conexión, se sincronizará automáticamente.

### ¿Puedo editar un contenido que ya está en una playlist?
Sí, pero deberás **volver a publicar la playlist** para que los cambios se apliquen a las pantallas.

### ¿Cómo cambio mi contraseña?
Ve a **"Configuración"** (icono de engranaje) → **"Cuenta"** → **"Cambiar contraseña"**.

---

**¿Necesitas ayuda adicional?** Contacta al administrador de tu workspace o al equipo de IT.
