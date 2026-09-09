-- CreateTable
CREATE TABLE "IncidenciaImportacion" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "fila" INTEGER NOT NULL,
    "placaSena" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "resuelta" BOOLEAN NOT NULL DEFAULT false,
    "equipoId" TEXT,

    CONSTRAINT "IncidenciaImportacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IncidenciaImportacion_hash_grupo_fila_key" ON "IncidenciaImportacion"("hash", "grupo", "fila");
