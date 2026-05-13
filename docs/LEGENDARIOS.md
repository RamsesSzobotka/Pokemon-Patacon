# Legendarios - Pokemon Patacon

**Versión:** 1.0  
**Fecha:** 13 de Mayo de 2026  
**Total Especial:** 48 Pokémon (35 Legendarios + 13 Mythicals)

---

## ⚙️ Regla de Legendarios

**Restricción:** Máximo 1 Pokémon legendario o mythical por equipo.

**Validación:** El backend valida en `team:confirmed` que no haya más de 1.

```typescript
// Pseudocódigo de validación
const legendaryCount = team.filter(p => p.is_legendary || p.is_mythical).length;
if (legendaryCount > 1) {
  return error("Too many legendaries in team");
}
```

---

## 📋 Legendarios (35)

Pokémon considerados **legendarios** por PokeAPI (batallas como jugadores finales/evento).

### Generación I (4)

| ID | Nombre | Tipos |
|----|--------|-------|
| 144 | Articuno | ice, flying |
| 145 | Zapdos | electric, flying |
| 146 | Moltres | fire, flying |
| 150 | Mewtwo | psychic |

### Generación II (5)

| ID | Nombre | Tipos |
|----|--------|-------|
| 243 | Raikou | electric |
| 244 | Entei | fire |
| 245 | Suicune | water |
| 249 | Lugia | psychic, flying |
| 250 | Ho-oh | fire, flying |

### Generación III (7)

| ID | Nombre | Tipos |
|----|--------|-------|
| 377 | Regirock | rock |
| 378 | Regice | ice |
| 379 | Registeel | steel |
| 380 | Latias | dragon, psychic |
| 381 | Latios | dragon, psychic |
| 382 | Kyogre | water |
| 383 | Groudon | ground |
| 384 | Rayquaza | dragon, flying |

### Generación IV (12)

| ID | Nombre | Tipos |
|----|--------|-------|
| 480 | Uxie | psychic |
| 481 | Mesprit | psychic |
| 482 | Azelf | psychic |
| 483 | Dialga | steel, dragon |
| 484 | Palkia | water, dragon |
| 485 | Heatran | fire, steel |
| 486 | Regigigas | normal |
| 487 | Giratina-altered | ghost, dragon |
| 488 | Cresselia | psychic |

### Generación V (7)

| ID | Nombre | Tipos |
|----|--------|-------|
| 638 | Cobalion | steel, fighting |
| 639 | Terrakion | rock, fighting |
| 640 | Virizion | grass, fighting |
| 641 | Tornadus-incarnate | flying |
| 642 | Thundurus-incarnate | electric, flying |
| 643 | Reshiram | dragon, fire |
| 644 | Zekrom | dragon, electric |
| 645 | Landorus-incarnate | ground, flying |
| 646 | Kyurem | dragon, ice |

---

## ✨ Mythicals (13)

Pokémon considerados **mythical** por PokeAPI (eventos especiales, no capturables sin evento).

### Generación I (1)

| ID | Nombre | Tipos |
|----|--------|-------|
| 151 | Mew | psychic |

### Generación II (1)

| ID | Nombre | Tipos |
|----|--------|-------|
| 251 | Celebi | psychic, grass |

### Generación III (2)

| ID | Nombre | Tipos |
|----|--------|-------|
| 385 | Jirachi | steel, psychic |
| 386 | Deoxys-normal | psychic |

### Generación IV (5)

| ID | Nombre | Tipos |
|----|--------|-------|
| 489 | Phione | water |
| 490 | Manaphy | water |
| 491 | Darkrai | dark |
| 492 | Shaymin-land | grass |
| 493 | Arceus | normal |

### Generación V (4)

| ID | Nombre | Tipos |
|----|--------|-------|
| 494 | Victini | psychic, fire |
| 647 | Keldeo-ordinary | water, fighting |
| 648 | Meloetta-aria | normal, psychic |
| 649 | Genesect | bug, steel |

---

## 📊 Estadísticas

| Categoría | Cantidad |
|-----------|----------|
| **Legendarios totales** | 35 |
| **Mythicals totales** | 13 |
| **Total especial** | 48 |
| **Porcentaje del pool** | 48 / 493 = 9.7% |

---

## 🎯 Distribución por Tipo

**Legendarios por tipo atacante (primario):**

| Tipo | Cantidad |
|------|----------|
| Psychic | 8 |
| Dragon | 6 |
| Flying | 4 |
| Fire | 4 |
| Water | 3 |
| Steel | 2 |
| Rock | 2 |
| Ghost | 1 |
| Electric | 1 |
| Fighting | 1 |
| Grass | 1 |
| Ground | 1 |
| Normal | 1 |
| Dark | 1 |

---

## ✅ Validación JSON

Los 48 especiales están marcados en `gen5-pokemon-expanded.json`:

- `is_legendary: true` → 35 Pokémon
- `is_mythical: true` → 13 Pokémon
- Ninguno tiene ambos flags en true (mutuamente excluyentes)

**Código de validación:**

```json
legendaries: [
  { "id": 144, "is_legendary": true, "is_mythical": false },
  { "id": 151, "is_legendary": false, "is_mythical": true },
  ...
]
```

---

## 🚀 Implementación

**Backend (Bun):**

```typescript
// En initPokemonData()
const allPokemon = await db.collection('pokemon').find({}).toArray();
const legendariesCache = allPokemon.filter(p => p.is_legendary || p.is_mythical);
// Guardar en memoria para validación rápida

// En validar equipo:
function validateTeam(team: Pokemon[]) {
  const legendaryCount = team.filter(p => 
    legendariesCache.some(leg => leg.id === p.id)
  ).length;
  
  if (legendaryCount > 1) {
    throw new Error("Maximum 1 legendary per team");
  }
}
```

**Frontend (TanStack Start):**

```typescript
// En selector de equipo
const isLegendary = (pokemonId: number) => legendariesList.includes(pokemonId);

function onPokemonSelected(pokemon: Pokemon) {
  const currentLegendaries = selectedTeam.filter(p => isLegendary(p.id)).length;
  
  if (isLegendary(pokemon.id) && currentLegendaries >= 1) {
    showError("You can only have 1 legendary per team");
    return;
  }
  
  selectPokemon(pokemon);
}
```

