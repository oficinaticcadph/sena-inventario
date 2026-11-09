ALTER TABLE "Movimiento" DROP CONSTRAINT "Movimiento_autoria_check";
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_autoria_check" CHECK (
  "autorId" IS NOT NULL OR
  ("tipo" = 'generacion' AND "formato" IS NOT NULL AND "formato" = 'PDF'
    AND ("solicitante" IS NULL OR length(trim("solicitante")) >= 3))
);
