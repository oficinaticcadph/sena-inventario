CREATE TABLE "EquipoEliminado" (
  "id" TEXT NOT NULL,
  "equipoId" TEXT NOT NULL,
  "placaSena" TEXT NOT NULL,
  "autorId" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "respaldo" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EquipoEliminado_pkey" PRIMARY KEY ("id")
);
