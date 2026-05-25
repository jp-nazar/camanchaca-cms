# Guía de Demo — Camanchaca CMS

Guía para demostrar el valor del producto a Camanchaca en reunión de venta. El foco es **persistencia, monitoreo y control remoto**.

---

## 1. Validar el dolor actual (2 min)

> *"Ustedes tienen dashboards con información crítica para la operación — planificación, calidad, seguridad, despacho. Pero hoy dependen de navegadores web en las TVs: sesiones que expiran, pantallas congeladas, negros. Y cuando falla, alguien tiene que ir físicamente a la planta a arreglarlo."*

**Objetivo:** Hacerles sentir que entendimos el problema exacto.

---

## 2. La promesa: de "navegador abierto" a "nodo operacional confiable" (3 min)

> *"No les estamos vendiendo pantallas más bonitas. Les estamos vendiendo que la información crítica nunca se caiga."*

| Hoy | Con Camanchaca CMS |
|-----|-------------------|
| Navegador genérico | Player dedicado (Android TV con ExoPlayer) |
| Sesión expira, toca loguear de nuevo | Autenticación gestionada por el sistema, sin intervención |
| Pantalla congelada = alguien va a planta | Heartbeat cada 15s + reconexión automática + alertas |
| No saben si una pantalla está caída hasta que alguien avisa | Dashboard central con estado online/offline en tiempo real |
| Sin internet = pantalla muerta | Service Worker: sigue mostrando contenido cacheado |

---

## 3. Puntos fuertes para demostrar (10–15 min)

### A. Persistencia: la pantalla nunca se cae

- **WebSocket persistente**: si se corta la red, se reconecta solo. No hay que ir a la TV.
- **Service Worker offline**: si se corta internet, la TV sigue mostrando el último contenido en loop. No queda en negro.
- **Kiosk mode (Android TV)**: la app es el launcher del dispositivo. No pueden salirse, no pueden cerrarla accidentalmente.
- **Recovery automático**: reinicio de app, reconexión de red, reintentos de integración.

### B. Monitoreo centralizado: ven todo sin ir a planta

- **Dashboard en vivo** con estado de cada pantalla (online/offline, último heartbeat).
- **Screenshots remotos**: *"¿Qué está mostrando la pantalla de Calidad ahora?"* → Click, ven la captura en el admin.
- **Telemetry**: batería, almacenamiento, RAM, CPU, señal WiFi. Saben si un dispositivo está fallando antes de que se caiga.
- **Alertas por email** cuando una pantalla se desconecta (con deduplicación, no spam).

### C. Control remoto: recuperar sin moverse de la oficina

- **Comandos masivos**: reiniciar, apagar, encender, actualizar — a una pantalla o a un grupo completo.
- **Remote touch injection**: si hay un popup bloqueando, pueden tocar la pantalla remotamente desde el admin.
- **Cola de comandos**: si una pantalla está offline, el comando se encola y se ejecuta cuando vuelva.

### D. Integraciones: los dashboards existentes siguen funcionando, pero confiables

- **Power BI**: OAuth2 + ExportTo PNG. El worker descarga el dashboard cada X minutos, compara byte a byte, y solo actualiza si cambió. Las TVs no descargan innecesariamente.
- **Looker Studio / URLs personalizadas**: refresco automático con detección de cambios.
- **Cache inteligente**: el navegador de la TV usa ETag. Si el dashboard no cambió, no se transfiere nada. **Ahorro de hasta 83% de ancho de banda** vs. implementaciones con timestamp.

### E. Gestión operacional: playlists, scheduling, layouts

- **Layouts multi-zona**: dividir la pantalla en fullscreen, split, L-bar, PiP, grid. Un lado el dashboard de Calidad, otro lado KPIs de Planta.
- **Scheduling**: reglas por turno, día de la semana. Ej: de 6am a 2pm muestra dashboard de Planificación, de 2pm a 10pm muestra Seguridad.
- **Video walls**: sincronizar múltiples displays como una sola pantalla.
- **Multi-tenant**: diferentes áreas/workspaces con contenido aislado.

---

## 4. Script de demo en vivo sugerido (5–10 min)

### Paso 1: Dashboard de monitoreo
Abrir el admin dashboard y mostrar la grilla de pantallas con estado online/offline. Señalar que ven todas las TVs desde un solo lugar.

### Paso 2: Screenshot remoto
Abrir una pantalla específica y pedir un screenshot remoto. Mostrar que ven **exactamente** qué está pasando en ese momento.

### Paso 3: Simular corte de red
Desconectar WiFi de una TV Android:
- El dashboard la marca como **offline**.
- La TV sigue reproduciendo contenido cacheado — **no queda en negro**.
- Reconectar WiFi, mostrar que vuelve a **online** sola.

### Paso 4: Comando remoto
Enviar un comando de **"Actualizar"** o **"Reiniciar"** a una TV desde el admin. Ver cómo responde en segundos.

### Paso 5: Integración Power BI
Mostrar una integración Power BI funcionando:
- El dashboard se refresca automáticamente cada X minutos.
- No hay que ir a la TV a recargar el navegador.
- El worker detecta cambios y solo actualiza cuando el dashboard realmente cambió.

---

## 5. El ROI: ¿qué ganan? (2 min)

| Antes | Después |
|-------|---------|
| X viajes a planta por semana para arreglar pantallas | Control remoto desde el admin |
| Pantallas caídas que nadie nota hasta que es crítico | Alertas inmediatas + monitoreo 24/7 |
| Sesiones expiradas, logins manuales | Autenticación transparente, sin intervención |
| Contenido desactualizado porque el refresh falló | Integraciones automáticas con detección de cambios |
| Ancho de banda alto por refrescos constantes | Cache inteligente, 83% de ahorro |

> *"La pregunta no es cuánto cuesta la plataforma. La pregunta es cuánto les cuesta hoy tener gente yendo a planta a arreglar navegadores."*

---

## 6. Roadmap de evolución (2 min)

| Fase | Qué incluye |
|------|-------------|
| **Fase 1 (Ya)** | Estabilidad base, players confiables, monitoreo, control remoto |
| **Fase 2** | Automatización: alertas proactivas, scheduling avanzado |
| **Fase 3** | Integración de datos: Power BI, Looker, BigQuery |
| **Fase 4** | Inteligencia operacional: detección de anomalías, near real-time, IA |

> *"Empezamos con el problema de hoy: que las pantallas no se caigan. Pero la plataforma está diseñada para crecer hacia inteligencia operacional."*

---

## 7. Cierre concreto (1 min)

> *"Camanchaca CMS no es un visor web. Es una plataforma de operación visual industrial. Cada pantalla pasa de ser un 'navegador abierto' a un nodo gestionado, monitoreado y resiliente. Ustedes se quedan con la plataforma, se la instalan en su infraestructura, y tienen control total."*

**Próximo paso sugerido:**
> *"¿Podemos hacer un piloto en una planta con 2–3 pantallas para que vean la diferencia en una semana?"*
