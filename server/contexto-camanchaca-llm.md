# Contexto de proyecto — Camanchaca CMS para administración de pantallas

## Propósito de este documento
Este documento resume el contexto estratégico, operacional y técnico del proyecto Camanchaca para que cualquier LLM, desarrollador o colaborador entienda **por qué** se está construyendo este software, cuál es el problema real a resolver y qué principios deben guiar las decisiones de producto y arquitectura. Está escrito desde la perspectiva de **App Facttory** como proveedor tecnológico de la solución.[file:2][file:6][file:1]

## Quién es el cliente y qué necesita realmente
Camanchaca opera en un entorno industrial acuícola/salmonero donde la información visual en planta no es un lujo ni un dashboard corporativo más: es parte de la operación diaria y de la capacidad de reaccionar a tiempo frente a desvíos, calidad, seguridad, despacho y continuidad productiva.[file:2]

El cliente no necesita solamente “pantallas bonitas”. Necesita una plataforma confiable para que la información crítica esté siempre visible, actualizada y legible en planta, sin depender de intervención manual constante ni de sesiones frágiles en navegadores tradicionales.[file:2][file:6]

## Problema de fondo
El dolor principal del proyecto **no es UX aislada** y tampoco es únicamente BI. El problema real es la **continuidad operacional del sistema de visualización en planta**.[file:2][file:6][file:1]

### Síntomas observados hoy
- Las pantallas dependen de dashboards ejecutados directamente en navegadores web tradicionales.[file:2]
- Las sesiones expiran y vuelven a pedir login o SSO.[file:2][file:6]
- Algunas pantallas se congelan, quedan en negro o dejan de refrescar.[file:2]
- La operación depende de intervención manual para recuperar visualización.[file:2]
- La información no siempre se muestra con inmediatez suficiente para la operación.[file:2][file:6]
- La experiencia visual actual no está optimizada para lectura rápida en TV industrial o pantallas de planta.[file:2]
- No existe una capa robusta de monitoreo centralizado del estado real de cada pantalla.[file:2][file:6]
- No existe fallback offline ni una estrategia clara de autorecuperación ante fallas de red, sesión o dispositivo.[file:6]

### Interpretación correcta del problema
Si un dashboard tiene buenos datos, pero la pantalla pierde sesión, no refresca o queda en negro, entonces el sistema **fracasa operativamente**. Por eso este proyecto debe ser entendido como una solución de **operación visual industrial confiable**, no como un simple rediseño de dashboards.[file:2][file:6][file:1]

## Qué software se está construyendo
Se está construyendo una **plataforma CMS de administración de pantallas industriales** para Camanchaca, con foco en continuidad operacional, gestión remota, integración de dashboards y monitoreo del parque de pantallas.[file:2]

### Componentes esperados de la solución
1. **CMS de control operacional** para administrar pantallas, contenidos, dashboards, usuarios y asignación por áreas.[file:2]
2. **Player o capa de ejecución confiable** sobre Android TV o dispositivos dedicados, evitando depender de un navegador genérico como mecanismo principal de operación.[file:2][file:6]
3. **Integración con dashboards existentes** y futuras fuentes como Power BI, Looker Studio y eventualmente BigQuery u otras capas de datos.[file:2]
4. **Monitoreo centralizado** de estado online/offline, salud de dispositivos y continuidad de reproducción.[file:2][file:6]
5. **Automatización operacional** para scheduling, actualización de contenidos, alertas y recuperación ante fallas.[file:2][file:6]

## Qué NO debe asumirse del proyecto
- No es un proyecto de marketing digital signage tradicional.[file:2]
- No es solo un visor web embebido para abrir dashboards.[file:2][file:6]
- No es únicamente una mejora estética de UX/UI.[file:2][file:1]
- No debe diseñarse primero para escritorio corporativo; debe diseñarse para operación visual industrial en pantallas remotas y ambientes de planta.[file:2][file:6]

## Objetivo de negocio y de producto
El objetivo es entregar a Camanchaca una base tecnológica que permita:
- asegurar continuidad operacional de las pantallas;[file:2][file:6]
- reducir tiempos de reacción frente a eventos o desvíos operacionales;[file:6]
- centralizar administración de contenidos, dashboards y dispositivos;[file:2]
- evolucionar desde visualización estática/reportable hacia una capa de inteligencia operacional;[file:2][file:6]
- dejar una plataforma escalable sobre la cual luego se puedan montar alertas, automatizaciones, KPIs priorizados e incluso capacidades near real-time e IA.[file:2][file:1]

## Áreas operacionales involucradas
El contexto del proyecto considera dashboards o vistas para al menos estas áreas operacionales:
- Planificación
- Calidad
- Desviación
- Seguridad
- Despacho
- Recepción de materia prima
- Consumo
- Disponibilidad
- KPIs de planta
- Operación general

Estas áreas importan porque el CMS no debe pensarse como una grilla genérica de pantallas, sino como una herramienta capaz de organizar contenido por criticidad operacional, turnos, áreas, responsables y contexto de uso en planta.[file:2]

## Principios rectores para cualquier LLM o desarrollador
### 1. Reliability primero
Cada decisión debe priorizar estabilidad, autorecuperación y visibilidad continua por sobre sofisticación visual.[file:2][file:6][file:1]

### 2. El navegador tradicional no es la arquitectura final
La evidencia del proyecto apunta a que correr dashboards directamente en una TV mediante navegador fullscreen genera problemas de sesión, refresh y confiabilidad. La arquitectura correcta requiere player dedicado, kiosk controlado o una capa de signage con watchdog y reconexión automática.[file:2][file:6]

### 3. La pantalla es parte de la operación, no solo de reportes
La interfaz debe optimizar lectura rápida, jerarquía visual, visibilidad a distancia y comprensión inmediata en contexto industrial.[file:2]

### 4. Centralización obligatoria
El software debe permitir saber qué pantallas existen, qué muestran, si están online, cuándo fue su último refresh y cómo recuperarlas sin depender de presencia física en terreno.[file:2][file:6]

### 5. Seguridad y sesiones gestionadas
No se debe depender de soluciones frágiles como sesiones manuales persistidas en un navegador sin control. La capa de autenticación y refresco debe estar diseñada como parte de la solución, especialmente si se integran fuentes protegidas.[file:6]

### 6. Escalabilidad por fases
La plataforma debe nacer útil para el problema actual, pero preparada para crecer hacia automatización, alertas, integración de datos y monitoreo más avanzado.[file:2][file:1]

## Arquitectura mental recomendada
Pensar el proyecto en capas ayuda a no confundir el problema:

### Capa 1: Contenido operacional
Dashboards, KPIs, vistas por área, layouts y lógica de visualización para planta.[file:2][file:6]

### Capa 2: Orquestación de pantallas
CMS, asignación de contenido, scheduling, control remoto, grupos de pantallas, usuarios y permisos.[file:2][file:6]

### Capa 3: Runtime confiable
Player dedicado, modo kiosk, autostart, watchdog, reconexión de red, recuperación tras reinicio, fallback y continuidad visual.[file:2][file:6]

### Capa 4: Operación y observabilidad
Health checks, estado online/offline, último heartbeat, alertas, monitoreo centralizado y runbooks de recuperación.[file:6][file:1]

### Capa 5: Evolución de datos
Integraciones con Power BI, Looker Studio, BigQuery y futuras capacidades de automatización, anomalías e inteligencia operacional.[file:2][file:6]

## Motivo profundo de por qué construir este software
El software existe para cerrar una brecha entre los datos y la operación real. Hoy esa brecha se produce porque el dato puede existir, pero no llega de forma confiable a la pantalla correcta, en el momento correcto y con la continuidad que la planta necesita.[file:2][file:6]

Construir el mejor software para Camanchaca significa que cada pantalla pase de ser un “navegador abierto mostrando un dashboard” a ser un **nodo operacional gestionado**, monitoreado y resiliente dentro de una red de visualización industrial.[file:2][file:6]

## Qué valor espera percibir Camanchaca
Camanchaca debería percibir valor en cinco frentes concretos:
- Menos pantallas caídas o congeladas.[file:2]
- Menos dependencia de intervención manual y soporte reactivo.[file:2][file:6]
- Mayor visibilidad continua de KPIs críticos en planta.[file:2]
- Mejor tiempo de respuesta frente a incidencias operacionales.[file:6]
- Una base tecnológica más madura para modernizar dashboards, datos y automatización.[file:2][file:1]

## Cómo encaja en las propuestas comerciales
### P1 — Modernización UX/UI + Estabilidad Operacional
Rediseño, continuidad visual y mejora de estabilidad operacional. Esta capa justifica la base mínima del producto.[file:2][file:1]

### P2 — Smart Operations
Agrega alertas automáticas, automatización y una capa de operación más activa sobre la visualización.[file:2]

### P3 — Industrial Intelligence Platform
Evoluciona hacia BigQuery, near real-time e IA ready. Esta fase no reemplaza la confiabilidad base: la presupone.[file:2][file:1]

## Fases de proyecto que deben orientar las decisiones
### Fase 1 — Diagnóstico y auditoría
Entender sesiones, arquitectura actual, permisos, refresh, dispositivos y puntos de falla.[file:1][file:2]

### Fase 2 — Modernización UX/UI + estabilidad
Rediseñar dashboards y asegurar continuidad de visualización en planta.[file:1][file:2]

### Fase 3 — Automatización + alertas
Incorporar notificaciones, eventos operacionales y lógicas proactivas de reacción.[file:2]

### Fase 4 — Big Data operacional + IA
Consolidar una capa de datos más robusta y preparar evolución hacia analítica avanzada.[file:2]

## Implicancias de producto para el CMS
El CMS ideal para Camanchaca debería considerar, como mínimo:
- inventario de pantallas y dispositivos;
- asignación por área/planta/rol;
- playlists o layouts operacionales;
- programación horaria por turno o contexto;
- estado de conectividad y heartbeat;
- último refresh exitoso;
- control remoto o acciones de recuperación;
- manejo de usuarios y permisos;
- integración segura con fuentes de dashboards;
- fallback cuando la red o la autenticación fallen.

En este proyecto, “administrar pantallas” significa administrar **continuidad operacional**, no solo contenido.[file:2][file:6]

## Restricciones y realidad técnica ya conocidas
Actualmente existe una base operativa montada sobre Ubuntu en AWS EC2 con una aplicación desplegada y acceso por SSH, lo que sirve como base temporal de validación y desarrollo. Sin embargo, esa base no debe confundirse con la arquitectura final del problema de planta, porque el riesgo principal sigue siendo la continuidad operacional de pantallas y no solo el hosting de una app web.[file:1]

## Prompt base para otros LLM
Se puede usar este bloque como contexto inicial en otros modelos:

> Proyecto: Camanchaca CMS de administración de pantallas industriales.
> 
> Rol: Actúas como colaborador de App Facttory, proveedor tecnológico que diseña y construye una plataforma para administrar pantallas de planta en Camanchaca.
> 
> Problema real: Las pantallas industriales actuales dependen de dashboards abiertos en navegadores tradicionales, lo que provoca expiración de sesiones, congelamientos, pantallas en negro, falta de refresh, baja confiabilidad operacional y dependencia de intervención manual. El problema central no es solo UX ni BI; es continuidad operacional de la visualización en planta.
> 
> Objetivo: Diseñar y construir software que asegure administración centralizada de pantallas, reproducción confiable, monitoreo de estado, integración con dashboards existentes y evolución futura hacia alertas, automatización y analítica operacional.
> 
> Principios: reliability first; player dedicado o kiosk controlado en vez de navegador genérico; monitoreo centralizado; UX para lectura rápida en planta; seguridad y sesiones gestionadas; escalabilidad por fases.
> 
> Criterio de calidad: Toda recomendación debe priorizar continuidad operacional, resiliencia, recovery automático, observabilidad y facilidad de operación remota por sobre estética aislada.

## Criterio final de diseño
La mejor decisión técnica para Camanchaca será casi siempre la que responda mejor a esta pregunta:

**¿Esto hace más confiable, observable y operable la red de pantallas de planta?**[file:6][file:1][file:2]

Si la respuesta es sí, probablemente va en la dirección correcta. Si solo “se ve mejor”, pero no mejora continuidad, recuperación, monitoreo o administración, entonces no está resolviendo el problema principal del cliente.[file:2][file:6]
