ALTER TABLE "Movimiento" ALTER COLUMN "autorId" DROP NOT NULL;
ALTER TABLE "Movimiento" ADD COLUMN "solicitante" TEXT;
ALTER TABLE "Movimiento" ADD COLUMN "formato" TEXT;
UPDATE "Movimiento" SET "formato" = 'XLSX' WHERE "tipo" = 'generacion';
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_autoria_check" CHECK (
  "autorId" IS NOT NULL OR
  ("tipo" = 'generacion' AND "formato" IS NOT NULL AND "formato" = 'PDF' AND "solicitante" IS NOT NULL AND length(trim("solicitante")) >= 3)
);
