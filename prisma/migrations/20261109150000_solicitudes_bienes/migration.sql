CREATE TABLE "SolicitudBien" (
 "id" SERIAL PRIMARY KEY, "tokenHash" TEXT NOT NULL UNIQUE, "claveCreacion" TEXT NOT NULL UNIQUE,
 "hashInicial" TEXT NOT NULL, "datos" JSONB NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
 "origen" TEXT NOT NULL, "registradoPor" TEXT NOT NULL, "autorId" TEXT,
 "fechaSolicitud" DATE NOT NULL, "movimiento" TEXT NOT NULL, "destino" TEXT NOT NULL,
 "area" TEXT NOT NULL, "cuentadante" TEXT NOT NULL, "identificacion" TEXT NOT NULL, "busqueda" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 "deletedAt" TIMESTAMP(3),
 CONSTRAINT "SolicitudBien_tipo_check" CHECK ("movimiento" IN ('SALIDA','INGRESO'))
);
CREATE INDEX "SolicitudBien_deletedAt_fechaSolicitud_id_idx" ON "SolicitudBien"("deletedAt","fechaSolicitud","id");
CREATE TABLE "SolicitudBienEvento" (
 "id" TEXT PRIMARY KEY, "solicitudId" INTEGER NOT NULL REFERENCES "SolicitudBien"("id") ON DELETE RESTRICT,
 "version" INTEGER NOT NULL, "accion" TEXT NOT NULL, "detalle" TEXT NOT NULL,
 "actor" TEXT NOT NULL, "autorId" TEXT, "snapshot" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SolicitudBienEvento_solicitudId_createdAt_idx" ON "SolicitudBienEvento"("solicitudId","createdAt");
CREATE TABLE "SolicitudBienAdjunto" (
 "id" TEXT PRIMARY KEY, "solicitudId" INTEGER NOT NULL REFERENCES "SolicitudBien"("id") ON DELETE RESTRICT,
 "version" INTEGER NOT NULL, "nombre" TEXT NOT NULL, "tipo" TEXT NOT NULL, "size" INTEGER NOT NULL,
 "sha256" TEXT NOT NULL, "completo" BOOLEAN NOT NULL DEFAULT false, "actor" TEXT NOT NULL, "autorId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finalizadoAt" TIMESTAMP(3),
 CONSTRAINT "SolicitudBienAdjunto_size_check" CHECK ("size">0 AND "size"<=10485760)
);
CREATE INDEX "SolicitudBienAdjunto_solicitudId_completo_idx" ON "SolicitudBienAdjunto"("solicitudId","completo");
CREATE TABLE "SolicitudBienParte" (
 "adjuntoId" TEXT NOT NULL REFERENCES "SolicitudBienAdjunto"("id") ON DELETE CASCADE,
 "indice" INTEGER NOT NULL CHECK ("indice">=0 AND "indice"<20), "datos" BYTEA NOT NULL,
 PRIMARY KEY ("adjuntoId","indice"), CHECK (octet_length("datos")<=524288)
);
CREATE TABLE "LimiteBienes" ("clave" TEXT PRIMARY KEY,"intentos" INTEGER NOT NULL DEFAULT 0,"ventana" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
