#!/bin/bash
# Scripts de Prueba V3 - Instrucciones de Ejecución
# 
# Este documento proporciona instrucciones para compilar y ejecutar
# los tests básicos e integración para Version 3 (2 Turnos y Fatiga)

# ============================================
# REQUISITOS PREVIOS
# ============================================
# 1. Node.js 18+ instalado
# 2. npm dependencies instaladas: npm install
# 3. TypeScript compilador disponible: npm install -g typescript (opcional)

# ============================================
# ARCHIVO 1: testV3Basic.ts
# ============================================
# 27 Pruebas Unitarias que validan:
#
# GRUPO 1: DETECCIÓN (6 tests)
#   ✓ isMoveTwoTurn detecta movimientos de 2 turnos
#   ✓ isMoveTwoTurn retorna false para null
#   ✓ getTwoTurnMoveList retorna array correcto
#   ✓ isTwoTurnCharging con condiciones completas
#   ✓ isTwoTurnCharging retorna false con condiciones incompletas
#
# GRUPO 2: FASE DE CARGA (4 tests)
#   ✓ Solar Beam: Establece flags de carga
#   ✓ Fly: Establece flags evasivos
#   ✓ Skull Bash: Aplica +1 defensa
#   ✓ Carga duplicada no duplica flags
#
# GRUPO 3: FASE DE EJECUCIÓN (2 tests)
#   ✓ Solar Beam: Calcula daño correctamente
#   ✓ Fly: Limpia flags de evasión
#
# GRUPO 4: EVASIÓN (3 tests)
#   ✓ isDefenderEvading retorna true si está evadiendo
#   ✓ isDefenderEvading retorna false después de ejecutar
#   ✓ Ataque a Pokémon evadiendo hace 0 daño
#
# GRUPO 5: FATIGA (3 tests)
#   ✓ Hyper Beam aplica recharge fatigue
#   ✓ resetFatigueState limpia completamente
#   ✓ canActWithAilments bloquea por recharge
#
# GRUPO 6: RESET DE ESTADO (2 tests)
#   ✓ executeSwitch limpia V3 fields
#   ✓ executeSwitch preserva isFatigued
#
# GRUPO 7: INTEGRACIÓN BÁSICA (2 tests)
#   ✓ Ciclo Solar Beam: Carga → Ejecución → Daño
#   ✓ Hyper Beam + Fatiga bloquea siguiente turno
#
# GRUPO 8: CASOS EXTREMOS (2 tests)
#   ✓ Pokémon dañado puede cargar
#   ✓ Pokémon debilitado no puede cargar

# ============================================
# ARCHIVO 2: testV3Integration.ts
# ============================================
# 5 Escenarios de Batalla completos:
#
# ESCENARIO 1: SOLAR BEAM BATTLE
#   Turno 1: P1 carga Solar Beam, P2 ataca normalmente
#   Turno 2: P1 ejecuta Solar Beam (daño), P2 ataca
#   Turno 3: Ambos pueden actuar normalmente
#   ✓ Verifica ciclo de 2 turnos completo
#
# ESCENARIO 2: HYPER BEAM FATIGA
#   Turno 1: P1 usa Hyper Beam (150 poder, inmediato)
#   Turno 2: P1 está fatigado, NO PUEDE ACTUAR, P2 ataca libre
#   Turno 3: P1 recupera fuerzas, puede actuar nuevamente
#   ✓ Verifica recharge obligatorio y recuperación
#
# ESCENARIO 3: EVASIÓN DURANTE CARGA
#   Turno 1: P1 carga Fly (evasivo), P2 ataca (0 daño)
#   Turno 2: P1 ejecuta Fly (70 poder), P2 puede atacar
#   ✓ Verifica que ataques fallan contra Pokémon evadiendo
#
# ESCENARIO 4: SKULL BASH DEFENSE BOOST
#   Turno 1: P1 carga Skull Bash (+25% defensa)
#   Turno 2: P1 ejecuta Skull Bash (100 poder)
#   ✓ Verifica boost temporal de defensa
#
# ESCENARIO 5: SWITCH DURANTE CARGA
#   Turno 1: P1 Solar Beam carga
#   Turno 2: P1 cambia de Pokémon (flags limpiados)
#   Turno 3: Nuevo Pokémon puede actuar normalmente
#   ✓ Verifica limpieza de estados al cambiar

# ============================================
# CÓMO EJECUTAR LAS PRUEBAS
# ============================================

# Opción 1: Compilar y ejecutar scripts de prueba manualmente
# cd backend
# npx tsx scripts/testV3Basic.ts
# npx tsx scripts/testV3Integration.ts

# Opción 2: Agregar scripts npm (editar package.json):
# Agregar en la sección "scripts":
# {
#   "test:v3-basic": "tsx scripts/testV3Basic.ts",
#   "test:v3-integration": "tsx scripts/testV3Integration.ts"
# }
# Luego ejecutar:
# npm run test:v3-basic
# npm run test:v3-integration

# ============================================
# INSTALACIÓN RECOMENDADA EN package.json
# ============================================
# Editar backend/package.json y agregar estos scripts:

cat >> package.json << 'EOF'
  "test:v3-basic": "tsx scripts/testV3Basic.ts",
  "test:v3-integration": "tsx scripts/testV3Integration.ts",
  "test:v3": "npm run test:v3-basic && npm run test:v3-integration"
EOF

# Luego puedes ejecutar:
# npm run test:v3-basic       # Solo pruebas unitarias
# npm run test:v3-integration # Solo escenarios de integración
# npm run test:v3             # Ambos

# ============================================
# DEPENDENCIAS REQUERIDAS
# ============================================
# Para ejecutar estos tests, necesitas:
# - @types/node: Ya incluido en dev dependencies
# - typescript: Ya incluido
# - tsx: Para ejecutar TypeScript directamente (npm install -D tsx)

# Si no tienes tsx, instálalo con:
# npm install -D tsx

# ============================================
# SALIDA ESPERADA
# ============================================

# testV3Basic.ts debería mostrar:
# ✅ TEST 01: isMoveTwoTurn: Detecta movimiento de 2 turnos (Solar Beam)
# ✅ TEST 02: isMoveTwoTurn: Detecta ataque normal como NO 2 turnos
# ... (27 tests totales)
# 📊 RESUMEN DE PRUEBAS UNITARIAS V3
# Total de tests: 27
# ✅ Pasados: 27
# ❌ Fallidos: 0
# Porcentaje de éxito: 100.00%
# 🎉 ¡TODOS LOS TESTS PASARON!

# testV3Integration.ts debería mostrar:
# ============================================================
# ESCENARIO 01: Solar Beam Battle: Carga → Ejecución → Daño
# ============================================================
# ... (detalles de ejecución)
# ✅ ESCENARIO APROBADO: Solar Beam Battle
# ... (5 escenarios totales)
# 📊 RESUMEN DE ESCENARIOS DE INTEGRACIÓN V3
# Total de escenarios: 5
# ✅ Aprobados: 5
# ❌ Fallidos: 0
# Porcentaje de éxito: 100.00%
# 🎉 ¡TODOS LOS ESCENARIOS PASARON!

# ============================================
# RESOLUCIÓN DE PROBLEMAS
# ============================================

# Error: "Cannot find module 'tsx'"
# Solución: npm install -D tsx

# Error: "Cannot find module '../src/services/battleService'"
# Solución: Asegúrate de ejecutar desde la carpeta backend: cd backend

# Error de TypeScript
# Solución: npm run build primero para compilar el proyecto

# Tests fallan con errores de cálculo de daño
# Solución: Revisa que TEST_MOVES esté correctamente importado

# ============================================
# ESTRUCTURA DE ARCHIVOS CREADOS
# ============================================

# backend/scripts/testV3Basic.ts
#   ├── Importaciones de battleService
#   ├── Helper functions (createTestPokemon, test, assert*)
#   ├── Grupo 1-8: Tests unitarios (27 total)
#   └── Resumen final con contador de tests

# backend/scripts/testV3Integration.ts
#   ├── Importaciones de battleService
#   ├── Helper functions (createBattlePokemon, scenario, printPokemonState)
#   ├── Escenario 1-5: Batallas completas (5 total)
#   └── Resumen final con contador de escenarios

# ============================================
# NOTAS IMPORTANTES
# ============================================

# 1. Los tests usan TEST_MOVES (movimientos simulados) para evitar
#    dependencia de base de datos. Son independientes y rápidos.

# 2. Cada test imprime detalle de qué está siendo testeado y por qué.

# 3. Los escenarios de integración muestran el flujo completo de batalla
#    con mensajes que simulan lo que vería el usuario.

# 4. Si necesitas agregar más tests:
#    - Sigue el patrón: test("nombre", () => { ... })
#    - Usa las funciones helper: assertTrue, assertEqual, etc.
#    - Incremente totalTests al final

# 5. Si necesitas agregar más escenarios:
#    - Sigue el patrón: scenario("nombre", () => { ... })
#    - Retorna { passed: boolean, details: string[] }
#    - Cada detalle será impreso en orden

# ============================================
# INTEGRACIÓN CON CI/CD (Opcional)
# ============================================

# Si usas GitHub Actions, agregar a .github/workflows/test.yml:

cat >> .github/workflows/test.yml << 'EOF'
- name: Run V3 Tests
  run: |
    cd backend
    npm run test:v3-basic
    npm run test:v3-integration
EOF

# ============================================
# PRÓXIMOS PASOS
# ============================================

# 1. Ejecuta: npm run test:v3-basic
# 2. Ejecuta: npm run test:v3-integration
# 3. Asegúrate de que todos los tests pasen (27 + 5 = 32 total)
# 4. Si hay fallos, revisa los detalles en la salida
# 5. Abre issues en GitHub si encuentras problemas

echo "✅ Scripts de prueba V3 creados exitosamente"
echo "📍 Ubicación: backend/scripts/testV3Basic.ts"
echo "📍 Ubicación: backend/scripts/testV3Integration.ts"
echo ""
echo "Para ejecutar:"
echo "  cd backend"
echo "  npm install -D tsx  # Si no está instalado"
echo "  npx tsx scripts/testV3Basic.ts"
echo "  npx tsx scripts/testV3Integration.ts"
