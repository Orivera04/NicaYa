import { prisma } from "../src/db.js";
import { cleanDemoData } from "../src/services/demo-cleanup.service.js";

const confirmation = "MOTOYA_CLEANUP_CONFIRMED";

async function main() {
  if (process.env.MOTOYA_MAINTENANCE_CONFIRM !== confirmation) {
    throw new Error(`Operación bloqueada. Define MOTOYA_MAINTENANCE_CONFIRM=${confirmation} para ejecutar la limpieza.`);
  }

  const result = await cleanDemoData(prisma);
  console.info(JSON.stringify({ message: "Limpieza completada.", ...result }));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Error durante la limpieza.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
