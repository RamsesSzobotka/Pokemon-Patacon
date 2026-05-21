# Skill.md - Diseño de Interfaz (UI/UX)  
**Juego basado en Pokémon Ruby (GBA) — Only Battles**  
**Nombre del Proyecto:** [Tu Proyecto]  
**Versión:** 1.1  
**Fecha:** 20 de mayo de 2026  
**Estilo objetivo:** Inspirado en Pokémon Ruby (GBA): interfaz retro-modernizada, limpieza y claridad para combates individuales

## 1. Paleta de Colores Principal (Estética Ruby)

| Uso                    | Color Hex     | RGB               | Uso |
|------------------------|---------------|-------------------|-----|
| Fondo principal        | `#0A1F3D`     | 10,31,61          | Fondo oscuro estilo GBA  
| Acento principal       | `#E31C2B`     | 227,28,43         | Rojo Ruby  
| Acento secundario      | `#FFD700`     | 255,215,0         | Dorado (resaltes)  
| Texto principal        | `#FFFFFF`     | 255,255,255       | Blanco  
| Texto secundario       | `#B0C8E0`     | 176,200,224       | Azul claro  
| HP Verde               | `#48D048`     | 72,208,72         | Barra HP - seguro  
| HP Amarillo            | `#F8D048`     | 248,208,72        | Barra HP - aviso  
| HP Rojo                | `#F83030`     | 248,48,48         | Barra HP - crítico  
| Fondo de botones       | `#1E3A6B`     | 30,58,107         | Paneles/controles  

**Tipografía:**  
- Principal: `Pokemon GB` / `Press Start 2P` (pixel)  
- Títulos: Fuente bold, ligeramente redondeada (estética GBA adaptada)

**Fondos:** Imágenes estáticas o animaciones sutiles en bucle con estética GBA/Ruby (no exigir 3D).

## 2. Resolución Recomendada

- **Nativa:** 1280×720 (16:9) o 1920×1080  
- **Escalado:** UI vectorial + sprites pixel art escalados (mantener proporciones de GBA)  
- **Estilo visual:** Sprites pixel art grandes y limpios, overlays de UI tipo GBA (ventanas, bordes y marcos)

---

## 3. Flujo de Pantallas

### 3.1 Pantalla Inicial (Title Screen)

- Fondo: imagen/animación sutil con estética Ruby  
- Logo grande del juego en la parte superior  
- Botón principal: **COMENZAR** (visible, con resalte dorado)  
- Opciones pequeñas: Créditos / Opciones / Salir

### 3.2 Menú Principal (Post-Comenzar)

- Opciones claras:
  - Crear Sala  
  - Unirse a Sala  
  - Pokédex  
- Diseño compacto y legible, acorde a tipografía pixelada

### 3.3 Batalla Rápida (Random Match)

- Fondo: imagen del escenario con estética GBA  
- Botones grandes:
  - **Buscar Batalla** (animación simple de búsqueda)  
  - Selector de formato (si aplica)  
- Nota: El juego soporta combates individuales (1v1). No introducir modos de batalla doble u otros modos no implementados.

### 3.4 Crear Sala / Unirse a Sala

**Crear Sala:**
- Nombre de la sala  
- Modo: Random / Por reglas predefinidas (según implementación del proyecto)  
- Formato: Draft / Equipo propio (si el juego lo implementa)  
- Código de sala (generado)  
- Botón **Crear y Esperar**

**Unirse a Sala:**
- Input para código de sala  
- Lista de salas públicas (con filtro)  
- Vista previa de reglas

### 3.5 Lobby de Sala

- Fondo más neutro/dark para enfocarse en la UI  
- Lista de jugadores (hasta el límite actual del juego)  
- Información de reglas a la derecha  
- Chat en vivo (opcional)  
- Botones:
  - **Listo** (Ready) → indicador visual verde  
  - **Cambiar Equipo**  
  - **Salir**

- Cuando ambos están listos → cuenta regresiva → Draft o Batalla (según flujo implementado)

### 3.6 Pantalla de Draft (Ban & Pick)

- Presentación estilo grid con sprites pequeños/medianos  
- Zona de bans (si aplica)  
- Equipos de cada jugador (vista compacta)  
- Timer prominente  
- Indicador de turno (Pick / Ban)  
- Animaciones discretas de selección (brillo dorado)

### 3.7 Pantalla de Batalla (Estética GBA / Ruby)

**Layout Principal:**
- Información de jugadores y nombres en cabeceras  
- Sprites grandes estilo pixel art para ambos Pokémon (frontal/trasero según convención)  
- Barra de HP + Lv + Nombre  
- Iconos de estado junto a las barras  
- Caja de acciones en la parte inferior con opciones claras: LUCHA / MOCHILA / POKéMON / HUIR

**Elementos clave:**
- Sprites y efectos 2D (no 3D) con partículas y animaciones estilo GBA  
- HP con animación fluida (transiciones suaves en reducción/curación)  
- Log de batalla legible y compacto  
- No proponer mecánicas nuevas no implementadas (ej. dobles) en el diseño

### 3.8 Pokédex

- Fondo oscuro y lectura clara  
- Grid de Pokémon descubiertos con filtros básicos (tipo, generación si aplica)  
- Vista detallada: sprite grande, stats, tipos y descripción

---

## 4. Componentes UI Reutilizables

- **Caja de diálogo / Log:** Marco con borde dorado, fondo semitransparente oscuro  
- **Botones:** Rectángulos con borde sutil y estado hover/activo (brillo leve)  
- **Cursor/Selector:** Indicador simple (flecha o marcador pixelado)  
- **Tarjetas de Pokémon:** Marco según rareza/tipo con iconos pequeños  
- **Timer:** Rectangular con cuenta regresiva clara

## 5. Animaciones y Feedback

- Transiciones suaves entre pantallas (fade, slide) discretas  
- Hover: leve resalte y escalado (no exagerado)  
- "Listo" → confirmación visual verde  
- Draft: selección con flash breve + sonido sutil  
- Batalla: efectos de impacto y shake ligero en impactos importantes  
- Victoria/Derrota: pantalla destacada con animación simple (confeti o efecto oscuro moderado)

## 6. Assets Necesarios

- Fondos/tiles con estética GBA para: Title, Menú, Lobby, Draft, Batalla (opcionalmente animaciones sutiles)  
- Sprites pixel art de Pokémon (frontal/trasero según convención del juego)  
- Iconos de tipos y estados (estilo simple, baja resolución)  
- Frames y marcos para ventanas UI  
- Efectos/sonidos cortos para acciones clave (selección, golpe, victoria)

---

**Notas del diseñador:**  
El diseño prioriza claridad, legibilidad y la estética de Pokémon Ruby (GBA). Mantenerse dentro de las mecánicas y pantallas ya implementadas en el proyecto; no añadir modos o mecánicas nuevas (por ejemplo, batallas dobles) sin confirmación del equipo.