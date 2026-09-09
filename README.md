# Hoja de Vida Equipos SENA

Aplicación Next.js App Router, TypeScript, Tailwind CSS, Prisma y Postgres, con autenticación NextAuth y generación de Excel mediante ExcelJS.

## Estado de la entrega

- Aplicación funcional y verificada localmente; aún no publicada en Vercel.
- Postgres persistente en `private/postgres`, accesible solo desde este computador, puerto `55432`.
- **495 filas de origen**: 142 Funcionarios, 236 FORMACION y 117 ELECTRONICOS. Encabezados en fila 4, **64 columnas hasta BL**.
- **466 equipos de placa única** importados. **29 filas de placas repetidas** conservadas por separado en Postgres, visibles en `/admin/incidencias`. No se eligió arbitrariamente cuál fila debía prevalecer.
- Plantilla oficial limpia incluida: 100 combinaciones, formatos, bordes, logo y cuadros de clasificación. Sin datos, marca de clasificación ni firma manuscrita del ejemplo.
- Los Excel originales no fueron modificados.

## Acceder a la instalación entregada

Abre **http://localhost:3000** mientras los procesos locales estén activos. Usuario inicial: `jucsendoya`. La contraseña aleatoria está en **`private/acceso-inicial.txt`**, excluido de Git y Vercel.

Para reiniciar, abre dos terminales en esta carpeta:

```powershell
# Terminal 1, mantener abierta
npm.cmd run db:local
```

```powershell
# Terminal 2, mantener abierta
npm.cmd run start -- --hostname 127.0.0.1
```

Después de modificar código, ejecuta `npm.cmd run build` antes de iniciar producción. Para desarrollo usa `npm.cmd run dev -- --hostname 127.0.0.1`. En Windows se usa `npm.cmd` para evitar el bloqueo de `npm.ps1`; en otros sistemas puedes usar `npm`.

Cambia la contraseña inicial sin mostrarla en pantalla:

```powershell
npm.cmd run admin:setup
```

El script solicita confirmación, almacena solo el hash bcrypt y revoca sesiones anteriores. Después puedes eliminar el archivo de acceso inicial. El nombre del técnico en el Excel corresponde al nombre de la cuenta que genera el reporte; usa nombres completos al crear usuarios.

## Instalación desde cero

Requisitos: Node.js 22 o 24, npm y Postgres. `embedded-postgres` permite ejecutar Postgres local sin instalar un servicio de Windows.

```powershell
npm.cmd ci
npm.cmd run db:local
```

La primera ejecución crea `.env` con secretos aleatorios y el clúster persistente. No reemplaza un `.env` existente ni administra bases remotas. En otra terminal:

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run admin:setup
```

Configura `INVENTORY_PATH` en `.env` con la ruta del inventario original. Si deseas preparar otra copia del formato, configura `TEMPLATE_SOURCE_PATH` y ejecuta `npm.cmd run template:prepare`. Esta entrega ya incluye la plantilla limpia.

```powershell
npm.cmd run db:seed
```

El seed se detiene ante placas vacías o repetidas y guarda un informe privado. Tras revisarlo, este comando carga las placas únicas y conserva las repetidas en cuarentena:

```powershell
npm.cmd run db:seed -- --allow-quarantine
npm.cmd run build
npm.cmd run start -- --hostname 127.0.0.1
```

No se suben Excel a la aplicación. El script carga la base una vez. Identifica una importación previa por SHA-256 y no sobrescribe equipos ni contraseñas. Ante un archivo nuevo, tampoco reemplaza placas ya existentes. Conserva hoja, fila y valores de origen, y crea movimientos con autoría.

## Variables de entorno

Los secretos reales van en `.env` o en Vercel, nunca en `.env.example`.

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión Postgres. Para Vercel, utiliza el pool del proveedor. |
| `DIRECT_URL` | Conexión directa o modo sesión para migraciones. |
| `NEXTAUTH_URL` | Origen exacto de la aplicación. Local: `http://localhost:3000`. |
| `NEXTAUTH_SECRET` | Secreto aleatorio de al menos 32 bytes. |
| `SEED_ADMIN_USER` | Usuario inicial; por defecto `jucsendoya`. |
| `SEED_ADMIN_PASSWORD` | Opcional, para seed no interactivo. Mínimo 12 caracteres, máximo 72 bytes UTF-8. Se hashea con bcrypt, coste 12. |
| `INVENTORY_PATH` | Ruta local del inventario, solo para importación. |
| `TEMPLATE_SOURCE_PATH` | Ruta local del formato de origen, solo para preparar la plantilla. |

`admin:setup` permite crear la cuenta inicial sin guardar su contraseña en una variable de entorno. El script local de elaboración `bootstrap-local.ts` generó una contraseña aleatoria para esta instalación y nunca modifica una cuenta existente.

## Funciones y permisos

Cualquier visitante puede consultar el inventario, buscar por placa y ver los datos técnicos del equipo y su historial como lista, sin iniciar sesión. La opción **Entrar como administrador** aparece debajo de la consulta. La vista pública omite responsables, contactos, autoría y notas internas; muestra el tipo y fecha de cada movimiento. Las cuentas autorizadas conservan acceso a la ficha completa, edición según rol y descarga de Excel.

**Admin:** crea y edita equipos, reasigna cuentadantes, registra observaciones y realiza bajas lógicas. Administra cuentas admin/consulta y consulta la bitácora global. No puede desactivar su propia cuenta y debe quedar al menos un administrador activo.

**Consulta:** consulta fichas e historial y genera reportes. Puede completar campos manuales o datos mapeados vacíos únicamente para la descarga, sin modificar el inventario. Los datos ya presentes requieren edición y guardado por un administrador.

Ambos roles descargan `HOJA_DE_VIDA_[PLACA].xlsx`. El sistema registra la generación automáticamente; consulta no puede crear movimientos manuales. La fecha usa `America/Bogota` y el técnico se obtiene de la cuenta autenticada. No se fabrican firmas.

Los cambios de inventario y la auditoría se guardan en la misma transacción. Un número de versión detecta ediciones simultáneas. Las asignaciones, reasignaciones y devoluciones se identifican por el cambio de cuentadante. Los movimientos previos son inmutables desde la API: las aclaraciones se agregan como observaciones nuevas. La baja conserva el equipo y su historial. Los cambios de cuentas se registran en `EventoUsuario`.

## Mapeo del Excel

### Descarga pública en PDF

La ficha pública incluye **Descargar hoja de vida en PDF**. `GET /api/equipos/[id]/pdf` entrega `HOJA_DE_VIDA_[PLACA].pdf` sin iniciar sesión. El archivo se genera en el servidor con pdf-lib desde la estructura del formato limpio GTI-F-132, conserva el logo y los bloques del formulario, y utiliza tamaño A3 para mantenerlos legibles en una página. Si un dato extenso no cabe, su contenido completo pasa a un anexo.

El PDF solo recibe una lista explícita de campos técnicos y de software. Omite responsables, contactos, jefe, notas internas, hostname, dominio y firmas, independientemente de si quien lo descarga tiene sesión. No contiene un Excel adjunto ni admite cambios enviados por el visitante. El endpoint de Excel mantiene la autenticación obligatoria. Las descargas anónimas no crean movimientos atribuidos a un administrador.

`next.config.ts` incluye la plantilla también en la función PDF para el despliegue en Vercel. No requiere Excel, LibreOffice ni un servicio de conversión externo.

`src/lib/import-inventory.ts` define las columnas de origen; `src/lib/template.ts`, las celdas de destino.

| Campo | Columna | Celda |
| --- | --- | --- |
| Placa | K | G23 |
| Componente | C | A23 |
| Marca / modelo / serial | H / I / J | B23 / D23 / E23 |
| Cuentadante, fallback nombre completo | AS / AT | C17 |
| Sede | AJ | C19 |
| Dominio | AG | J13 |
| Disco / procesador / RAM | R / O / N | E35 / E36 / E37 |
| Hostname | Manual | J12 |
| Fecha | Fecha actual en Colombia | I10 / J10 / K10 |
| Técnico | Cuenta autenticada | C45 |

La sección **3. SOFTWARE BASE DE EQUIPO** conserva como valores iniciales los datos del Excel original: Windows 11 (24H2), Office 365 (2603), Windows Defender (1000.26100.0.1), Adobe Acrobat (2026), LAPS/MICROSOFT INTUNE, 7-Zip y los valores originales de VPN/JAFM PRO. Se pueden editar descripción, versión y licencia antes de descargar, o guardar por equipo como administrador. `src/lib/software.ts` centraliza esos valores base; los datos guardados prevalecen, incluso cuando se deja un campo vacío intencionalmente. Los valores base son los del formato, no una comprobación del software instalado. Jefe, partes, solicitud y diagnóstico siguen siendo manuales. La clasificación se deja sin marcar; ELECTRONICOS no se fuerza como administrativo ni formación.

ExcelJS edita las celdas y `src/lib/ooxml.ts` restaura los dibujos DrawingML que ExcelJS no conserva por sí solo. Retira la firma y la marca de clasificación del ejemplo, preservando logo y cuadros. El formato mantiene sus tamaños originales: textos extraordinariamente largos pueden requerir ajuste antes de imprimir. La plantilla está fuera de `public/`.

## Desplegar en Vercel con Postgres gestionado

1. Crea un proyecto en [Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres) o [Neon](https://neon.com/docs/connect/connect-from-any-app). Elige región y guarda las credenciales de forma privada. Prisma usa conexión Postgres, no claves públicas/anon.
2. Obtén una conexión con pool para `DATABASE_URL` y una directa o session pooler para `DIRECT_URL`. Sigue las indicaciones TLS del proveedor, normalmente `sslmode=require`.
3. Configura esas conexiones en un entorno local separado. Ejecuta `db:generate`, `db:migrate`, `admin:setup` y `db:seed` contra esa base. La semilla se ejecuta una vez, **no en cada build**. Para trasladar ediciones de la base local utiliza `pg_dump`/`pg_restore` a un destino nuevo; volver a sembrar no migra las ediciones.
4. Sube a un repositorio privado el código, lockfile, migraciones, logos y plantilla limpia. `.gitignore` y `.vercelignore` excluyen secretos, inventarios privados, base local y pruebas.
5. Importa el repositorio en [Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), selecciona Next.js y Node.js 22 o 24. Instalación: `npm ci`. Compilación: `npm run build`. Directorio de salida: predeterminado.
6. Configura en Vercel `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET` y `NEXTAUTH_URL`. Esta última debe coincidir con la URL HTTPS definitiva. No configures las rutas locales ni `SEED_ADMIN_PASSWORD` en Vercel.
7. Despliega y verifica login, permisos y descarga. `outputFileTracingIncludes` incluye la plantilla en la función de exportación; la generación usa runtime Node.js.
8. Para cambios posteriores de esquema ejecuta `db:migrate` desde un entorno confiable antes de desplegar. Usa bases independientes para producción y pruebas y conserva backups del proveedor.

Referencias: [Prisma 6 y Postgres](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql), [NextAuth](https://next-auth.js.org/configuration/options), [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).

## Seguridad

- Hash bcrypt, coste 12, y límites por bytes para evitar truncamiento de contraseñas.
- Sesiones de 8 horas. Cada acceso protegido verifica cuenta activa y versión de sesión en Postgres; desactivar una cuenta revoca sus sesiones.
- Proxy protege `/admin`; las API de escritura y descarga Excel comprueban autenticación y rol en el servidor. Inicio, sugerencias, ficha pública y descarga PDF no requieren sesión.
- Origen obligatorio para escrituras y descargas Excel; CSRF de NextAuth para login. La descarga pública de PDF es de solo lectura.
- Diez intentos de login por usuario cada 15 minutos mediante contador atómico compartido en Postgres.
- Validación de campos, límites de solicitud y consultas parametrizadas con Prisma.
- Datos protegidos sin caché compartida, sin indexación ni inventarios públicos.
- Contactos y secuencias numéricas sensibles enmascarados para consulta. El servidor no entrega el JSON original completo a ese rol.
- Auditoría, transacciones, control de versiones y bajas lógicas.

## Verificación

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
# Con base local y aplicación encendidas:
node node_modules/tsx/dist/cli.mjs scripts/test-integration.ts
```

Las pruebas de integración usan solo `127.0.0.1:55432`, crean sus propias cuentas/equipos y eliminan esos registros al terminar. Cubren login real, accesos sin sesión, roles, origen, PII, Excel, autoría, edición temporal, reasignación, concurrencia, baja y revocación.

Las pruebas de Excel comprueban el mapeo, fecha colombiana, ausencia de datos/firma del ejemplo, logo, combinaciones, bordes, tipografía, tamaños y configuración de página. Se renderizó una muestra sintética para revisar el formato. El renderizador auxiliar depende de herramientas del entorno de elaboración; no es necesario para operar la aplicación.

## Estructura

- `src/app/`: páginas y API.
- `src/components/`: interfaz y formularios.
- `src/lib/`: acceso, importación, validaciones y generación Excel.
- `prisma/`: esquema y migraciones.
- `scripts/`: seed, Postgres local, contraseña y pruebas de integración.
- `templates/GTI-F-132.xlsx`: formato limpio.
- `private/`: datos y credenciales locales, **nunca publicar**.

Los logos suministrados se usan sin recolorearlos. La interfaz usa verde `#39A900`, verde oscuro `#007832`, azul `#00304D` y Work Sans alojada con la aplicación; Calibri como alternativa.
