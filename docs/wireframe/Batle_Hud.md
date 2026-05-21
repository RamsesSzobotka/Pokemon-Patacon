# Pokémon Battle UI Wireframe
Inspiración de distribución: Pokémon Sword/Shield  
Objetivo: Mostrar únicamente estructura y jerarquía visual.

┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                                        ENEMY POKÉMON AREA            │
│                                                                      │
│                                   ┌───────────────────────────────┐  │
│                                   │ pokemon Name          Lv.50   │  │
│                                   │ HP ████████████████           │ ← Barra arriba        
│                                   └───────────────────────────────┘  │
│                                     [ Enemy Pokémon Sprite ]         │
│                                                                      │       
│                                                                      │
│   PLAYER POKÉMON AREA                               ┌───────────────┐│
│  ┌──────────────────────────────┐                   │   luchar      ││
│  │ pokemon  name    Lv.50       │                   │   Pokémon     ││
│  │ HP ████████████              │                   │   mochila     ││
│  └──────────────────────────────┘                   │   rendirse    ││
│   [ Player Pokémon sprite ]                         └───────────────┘│
│                                                                      │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ACTION PANEL (Vertical)                                            │
│                                                                      │
│   ┌──────────────────────────┐                                       │
│   │ ► Fight                  │                                       │
│   │ ► Pokémon                │                                       │
│   │ ► Bag                    │                                       │
│   │ ► Run                    │                                       │
│   └──────────────────────────┘                                       │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   NARRATION / MESSAGE OVERLAY                                        │
│   (Solo aparece cuando hay mensajes)                                 │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │ "Pikachu used Thunderbolt!"                                  │   │
│   │                                                              │   │
│   │ Fondo negro/transparente para seguir viendo el escenario     │   │
│   │ y parcialmente los Pokémon detrás.                           │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   [ Cuando no hay mensajes → este panel desaparece completamente ]   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘


## Jerarquía General

1. Fondo / escenario de batalla
2. Pokémon enemigo
3. UI enemigo (HP arriba del Pokémon)
4. Pokémon jugador
5. UI jugador (HP arriba del Pokémon)
6. Panel lateral de acciones
7. Overlay de narración dinámico encima de la parte baja

---

## Reglas de Comportamiento

### Barras de Vida
- Siempre visibles.
- Posicionadas arriba de cada Pokémon.
- Mantienen proximidad visual con su dueño.

### Menú de Acciones
- Vertical.
- Alineado lateralmente.
- Navegación de arriba → abajo.
- Visible durante selección de turno.

### Narración
- Overlay temporal.
- Semitransparente.
- No empuja elementos del layout.
- Aparece/desaparece con animación fade.
- Solo un mensaje visible a la vez.
- Los mensajes nuevos reemplazan el actual.

---

## Flujo Visual del Turno

1. Jugador selecciona acción.
2. Menú se bloquea.
3. Aparece overlay narrativo:
   - “Charizard used Flamethrower!”
4. Animación del ataque.
5. Overlay cambia:
   - “It’s super effective!”
6. Overlay desaparece.
7. Regresa control al jugador.

---

## Distribución Simplificada

```text
┌──────────────────────────────┐
│                   Enemy HP   │
│                 Enemy Pokémon│    
│                              │
│                Actions Menu  │
│                              │
│ Player HP                    │
│ Player Pokémon               │
├──────────────────────────────┤
│ Narration Overlay            │
└──────────────────────────────┘