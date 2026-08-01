import { prisma } from "../src/db.js";
import { protectImageInput } from "../src/lib/protected-media.js";

function encryptLegacy(value: string | null): string | null {
  if (!value || value.startsWith("enc:v1:")) return value;
  return protectImageInput(value);
}

async function main(): Promise<void> {
  let protectedDocuments = 0;
  let protectedPayments = 0;
  const documents = await prisma.riderDocument.findMany({
    where: { OR: [{ frontImage: { startsWith: "data:image/" } }, { backImage: { startsWith: "data:image/" } }] },
    select: { id: true, frontImage: true, backImage: true },
  });
  for (const document of documents) {
    await prisma.riderDocument.update({ where: { id: document.id }, data: { frontImage: encryptLegacy(document.frontImage), backImage: encryptLegacy(document.backImage) } });
    protectedDocuments += 1;
  }

  const payments = await prisma.payment.findMany({ where: { proofReference: { startsWith: "data:image/" } }, select: { id: true, proofReference: true } });
  for (const payment of payments) {
    await prisma.payment.update({ where: { id: payment.id }, data: { proofReference: encryptLegacy(payment.proofReference) } });
    protectedPayments += 1;
  }

  console.log(`Protected ${protectedDocuments} rider records and ${protectedPayments} payment records.`);
}

main()
  .catch((error: unknown) => {
    console.error("Legacy media encryption failed.", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
