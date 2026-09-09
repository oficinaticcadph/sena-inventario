-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('admin', 'consulta');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('alta', 'asignacion', 'reasignacion', 'devolucion', 'edicion', 'baja', 'generacion');

-- CreateTable
CREATE TABLE "Administrador" (
    "id" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'consulta',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Administrador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuentadante" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "jefe" TEXT NOT NULL DEFAULT '',
    "sede" TEXT NOT NULL DEFAULT '',
    "contacto" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Cuentadante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipo" (
    "id" TEXT NOT NULL,
    "placaSena" TEXT NOT NULL,
    "componente" TEXT NOT NULL DEFAULT '',
    "marca" TEXT NOT NULL DEFAULT '',
    "modelo" TEXT NOT NULL DEFAULT '',
    "serial" TEXT NOT NULL DEFAULT '',
    "sede" TEXT NOT NULL DEFAULT '',
    "disco" TEXT NOT NULL DEFAULT '',
    "procesador" TEXT NOT NULL DEFAULT '',
    "ram" TEXT NOT NULL DEFAULT '',
    "dominio" TEXT NOT NULL DEFAULT '',
    "hostname" TEXT NOT NULL DEFAULT '',
    "ficha" JSONB NOT NULL DEFAULT '{}',
    "contexto" JSONB NOT NULL DEFAULT '{}',
    "origen" JSONB NOT NULL DEFAULT '{}',
    "grupo" TEXT NOT NULL DEFAULT 'Manual',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "cuentadanteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimiento" (
    "id" TEXT NOT NULL,
    "equipoId" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "autorId" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "cambios" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoUsuario" (
    "id" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "destinoId" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginIntento" (
    "clave" TEXT NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ventana" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginIntento_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "Importacion" (
    "hash" TEXT NOT NULL,
    "archivo" TEXT NOT NULL,
    "resumen" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Importacion_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE UNIQUE INDEX "Administrador_usuario_key" ON "Administrador"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "Equipo_placaSena_key" ON "Equipo"("placaSena");

-- CreateIndex
CREATE INDEX "Equipo_grupo_activo_idx" ON "Equipo"("grupo", "activo");

-- CreateIndex
CREATE INDEX "Movimiento_equipoId_createdAt_idx" ON "Movimiento"("equipoId", "createdAt");

-- CreateIndex
CREATE INDEX "Movimiento_createdAt_idx" ON "Movimiento"("createdAt");

-- AddForeignKey
ALTER TABLE "Equipo" ADD CONSTRAINT "Equipo_cuentadanteId_fkey" FOREIGN KEY ("cuentadanteId") REFERENCES "Cuentadante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Administrador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoUsuario" ADD CONSTRAINT "EventoUsuario_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Administrador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
