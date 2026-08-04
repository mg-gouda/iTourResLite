/**
 * One-off (re-runnable) backfill: stamp `Booking.invoiceDueDate` = arrival + 45
 * days on every existing Jumbo (JMB) booking, so the SOA Statement report can
 * list rows created before the column existed. New bookings get the date from
 * BookingsService; other operators keep it null.
 *
 *   pnpm --filter @itour/db backfill:invoice-due
 */
import { PrismaClient } from "@prisma/client";
import { invoiceDueDate, JUMBO_OPERATOR_CODE } from "../../shared/src/invoice";

const prisma = new PrismaClient();

async function main() {
  const operator = await prisma.tourOperator.findUnique({
    where: { code: JUMBO_OPERATOR_CODE },
    select: { id: true },
  });
  if (!operator) {
    console.log(`No tour operator with code ${JUMBO_OPERATOR_CODE} — nothing to backfill.`);
    return;
  }

  const bookings = await prisma.booking.findMany({
    where: { tourOperatorId: operator.id },
    select: { id: true, arrivalDate: true, invoiceDueDate: true },
  });

  let updated = 0;
  for (const b of bookings) {
    const due = invoiceDueDate(b.arrivalDate);
    if (b.invoiceDueDate && b.invoiceDueDate.getTime() === due.getTime()) continue;
    await prisma.booking.update({ where: { id: b.id }, data: { invoiceDueDate: due } });
    updated++;
  }

  console.log(`Backfill complete: ${updated} of ${bookings.length} ${JUMBO_OPERATOR_CODE} bookings stamped.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
