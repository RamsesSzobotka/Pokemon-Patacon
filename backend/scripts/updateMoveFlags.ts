/**
 * Script standalone para actualizar los flags de movimientos en MongoDB.
 *
 * Ahora importa la lógica desde el servicio compartido:
 *   backend/src/services/updateMoveFlagsService.ts
 *
 * Ejecutar:
 *   cd backend && bun run scripts/updateMoveFlags.ts
 *
 * La misma lógica se ejecuta automáticamente al iniciar el servidor
 * (backend/src/index.ts → startServer()).
 */

import { connectDB, disconnectDB } from '../src/db/mongodb';
import { updateMoveFlags } from '../src/services/updateMoveFlagsService';

async function main() {
  console.log('🔌 Conectando a MongoDB...');
  await connectDB();
  console.log('✅ Conectado');

  try {
    const result = await updateMoveFlags();

    if (result.totalUpdated > 0) {
      console.log('\n✅ Script completado exitosamente!');
    } else {
      console.log('\n⚠️  No se modificó ningún movimiento (posiblemente ya estaban actualizados)');
    }

    console.log(`\nResumen:`);
    console.log(`  - Carga (2 turnos): ${result.chargeUpdated} movimientos`);
    console.log(`  - Recarga (recharge): ${result.rechargeUpdated} movimientos`);
  } catch (error) {
    console.error('\n❌ Error al ejecutar updateMoveFlags:', error);
    process.exit(1);
  } finally {
    await disconnectDB();
    console.log('🔌 Conexión cerrada');
  }
}

main();
