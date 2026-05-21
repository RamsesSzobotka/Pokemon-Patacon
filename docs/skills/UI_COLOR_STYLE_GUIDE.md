# Guía de Estilos UI - Pokemon Patacon

Este documento define el sistema de diseño visual para toda la aplicación Pokemon Patacon.

---

## Paleta de Colores

### Colores Principales

| Nombre | Hex | Uso |
|--------|-----|-----|
| Pokemon Red | `#E10600` | Color primario, botones principales, acentos |
| Sky Blue | `#00BFFF` | Color secundario, acentos azules, gradientes |
| Dark Background | `rgba(15, 15, 15, 0.85)` | Fondo principal de tarjetas |
| Card Background | `rgba(26, 26, 26, 0.6)` | Fondos de inputs, elementos secundarios |

### Colores de Texto

| Nombre | Hex | Uso |
|--------|-----|-----|
| White | `#f5f5f5` | Títulos, texto principal |
| Light Gray | `#B3B3B3` | Subtítulos, etiquetas, texto secundario |
| Medium Gray | `#888` | Texto de descripción, hints |
| Dark Gray | `#666` | Placeholders |

### Colores de Estado

| Nombre | Hex | Uso |
|--------|-----|-----|
| Success | `#2ECC71` | Estados ready, validación positiva |
| Error | `#E10600` | Errores, validación negativa |
| Warning | `#ff4444` | Hover en botones danger |

---

## Estructura de Tarjetas (Menu Card)

Fondo semi-transparente con efecto glassmorphism usado en toda la app.

```css
.menu-card, .card-container {
  background: rgba(15, 15, 15, 0.85);
  backdrop-filter: blur(10px);
  border: 1.5px solid rgba(225, 6, 0, 0.2);
  border-radius: 20px;
  padding: 50px 40px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.6),
    inset 0 1px 1px rgba(225, 6, 0, 0.1);
  max-width: 540px;
  width: 100%;
}
```

---

## Botones

### Estilos Base

```css
.btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 16px 28px;
  border: 1.5px solid transparent;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  text-transform: uppercase;
  letter-spacing: 1px;
  font-family: 'Montserrat', sans-serif;
  position: relative;
  overflow: hidden;
  background-clip: padding-box;
}

.btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(45deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%);
  animation: shine 3s ease-in-out infinite;
  pointer-events: none;
}
```

### Botón Primario (Rojo Pokémon)

```css
.btn-primary {
  background: linear-gradient(135deg, #E10600 0%, #cc0d0d 100%);
  color: #ffffff;
  border: 1.5px solid #E10600;
  box-shadow:
    0 0 20px rgba(225, 6, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-4px);
  box-shadow:
    0 12px 30px rgba(225, 6, 0, 0.5),
    0 0 30px rgba(225, 6, 0, 0.3);
  border-color: #ff4444;
  background: linear-gradient(135deg, #ff4444 0%, #E10600 100%);
}
```

### Botón Secundario (Gris con borde rojo)

```css
.btn-secondary {
  background: rgba(45, 45, 45, 0.7);
  color: #f5f5f5;
  border: 1.5px solid rgba(225, 6, 0, 0.3);
  backdrop-filter: blur(5px);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(60, 60, 60, 0.9);
  border-color: #E10600;
  transform: translateY(-4px);
  box-shadow:
    0 12px 28px rgba(225, 6, 0, 0.3),
    0 0 20px rgba(0, 181, 255, 0.1);
}
```

### Botón Terciario (Outline)

```css
.btn-tertiary {
  background: transparent;
  color: #B3B3B3;
  border: 1.5px solid rgba(225, 6, 0, 0.3);
  font-size: 11px;
}

.btn-tertiary:hover:not(:disabled) {
  background: rgba(225, 6, 0, 0.15);
  border-color: #E10600;
  color: #f5f5f5;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(225, 6, 0, 0.2);
}
```

### Botón Danger

```css
.btn-danger {
  background: linear-gradient(135deg, #8b0000 0%, #6b0000 100%);
  color: #ffffff;
  border: 1.5px solid #E10600;
  box-shadow: 0 0 20px rgba(225, 6, 0, 0.3);
}
```

### Animación Semi-Flotante

Aplicable a botones principales de navegación.

```css
@keyframes float-subtle {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-3px); }
}

.btn-float {
  animation: float-subtle 3s ease-in-out infinite;
}

/* Delay escalonado para efecto dinámico */
.btn-float:nth-child(1) { animation-delay: 0s; }
.btn-float:nth-child(2) { animation-delay: 0.3s; }
.btn-float:nth-child(3) { animation-delay: 0.6s; }
.btn-float:nth-child(4) { animation-delay: 0.9s; }
.btn-float:nth-child(5) { animation-delay: 1.2s; }
```

---

## Inputs

```css
.bw-input {
  background-color: rgba(26, 26, 26, 0.6);
  border: 1.5px solid rgba(225, 6, 0, 0.2);
  color: #f5f5f5;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 14px;
  backdrop-filter: blur(5px);
  transition: all 0.3s ease;
}

.bw-input:focus {
  outline: none;
  border-color: #E10600;
  box-shadow:
    0 0 16px rgba(225, 6, 0, 0.4),
    inset 0 0 8px rgba(225, 6, 0, 0.1);
  background-color: rgba(26, 26, 26, 0.8);
  transform: translateY(-2px);
}

.bw-input.valid {
  border-color: #2ECC71;
  box-shadow: 0 0 16px rgba(46, 204, 113, 0.4);
}

.bw-input.error {
  border-color: #E10600;
  box-shadow: 0 0 16px rgba(225, 6, 0, 0.5);
  animation: shake 0.5s ease-in-out;
}
```

---

## Efectos Visuales

### Animaciones

```css
@keyframes shine {
  0%, 100% { transform: translateX(-100%); opacity: 0; }
  50% { opacity: 1; }
}

@keyframes glow-pulse {
  0%, 100% {
    filter: drop-shadow(0 0 8px rgba(225, 6, 0, 0.3)) drop-shadow(0 0 16px rgba(0, 181, 255, 0.1));
  }
  50% {
    filter: drop-shadow(0 0 16px rgba(225, 6, 0, 0.6)) drop-shadow(0 0 32px rgba(0, 181, 255, 0.2));
  }
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(30px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
```

### Partículas de Fondo

```css
.container-with-particles::before {
  content: '';
  position: absolute;
  width: 200%;
  height: 200%;
  background-image:
    radial-gradient(circle at 1px 1px, rgba(225, 6, 0, 0.1) 1px, transparent 1px),
    radial-gradient(circle at 2px 2px, rgba(0, 181, 255, 0.08) 1px, transparent 1px);
  background-size: 80px 80px, 120px 120px;
  animation: drift 20s linear infinite;
}
```

### Gradientes

```css
/* Separadores */
background: linear-gradient(90deg, transparent 0%, #E10600 20%, #00BFFF 50%, #E10600 80%, transparent 100%);

/* Loading bar */
background: linear-gradient(90deg, #E10600, #00BFFF, #E10600);

/* Código/Box */
background: linear-gradient(135deg, rgba(30, 30, 30, 0.8), rgba(45, 45, 45, 0.6));
```

---

## Tipografía

| Elemento | Font | Tamaño | Peso | Color |
|----------|------|--------|------|-------|
| Título | Cinzel / Trajan Pro / Montserrat | 36px | 900 | #f5f5f5 |
| Subtítulo | Montserrat | 12px | 500 | #B3B3B3 |
| Botones | Montserrat | 13px | 700 | #ffffff |
| Labels | - | 11px | - | #B3B3B3 |
| Código | Courier New | 32px | 900 | #E10600 |

---

## Responsive

```css
@media (max-width: 480px) {
  .menu-card {
    padding: 30px 20px;
    border-radius: 16px;
  }
  .title { font-size: 28px; }
  .btn {
    padding: 14px 16px;
    font-size: 12px;
    border-radius: 10px;
  }
}
```

---

## Variables CSS

```css
:root {
  --primary-red: #E10600;
  --primary-blue: #00BFFF;
  --bg-dark: rgba(15, 15, 15, 0.85);
  --bg-card: rgba(26, 26, 26, 0.6);
  --text-white: #f5f5f5;
  --text-gray: #B3B3B3;
  --success: #2ECC71;
  --border-red: rgba(225, 6, 0, 0.2);
  --border-red-hover: #E10600;
  --shadow-glow: 0 0 20px rgba(225, 6, 0, 0.3);
}
```