# Controles de producción de MotoYa

Este documento describe los controles obligatorios antes de poner el MVP a disposición de usuarios reales. No guarde secretos, archivos de identidad ni comprobantes en Git, en tickets o en capturas de pantalla.

## 1. Calidad obligatoria en GitHub

El workflow `Quality gate` ejecuta `lint`, `typecheck`, pruebas y build en cada pull request y push a `main`. El workflow `Scan secrets` analiza el historial para detectar secretos publicados por accidente.

Un administrador del repositorio debe crear una *ruleset* de protección para `main` en **GitHub → Settings → Rules → Rulesets** y exigir estos checks:

- `Verify application`
- `Scan secrets`

La misma regla debe bloquear pushes directos a `main` y requerir al menos una revisión. GitHub no permite que un archivo del repositorio active esa protección por sí solo; requiere permiso administrativo sobre el repositorio.

## 2. Secretos y sesiones

Configure los siguientes valores solamente en Render. Genérelos con un gestor de secretos o con `openssl rand -base64 48`:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `FILE_ENCRYPTION_KEY`
- `DATABASE_URL`

En producción use `NODE_ENV=production`, `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=lax` y un `CORS_ORIGIN` exacto (`https://motoya-web-55ei.onrender.com`). El refresh token ahora vive en una cookie `HttpOnly`; no se guarda en `localStorage` ni se expone al JavaScript del navegador.

`FILE_ENCRYPTION_KEY` es obligatoria para procesar evidencias en producción. Las imágenes nuevas de documentos y comprobantes se validan como JPEG, PNG o WebP, se limitan de tamaño y se cifran con AES-256-GCM antes de guardarse en PostgreSQL. Si falta la clave, la API rechaza esas cargas de forma segura; no las guarda sin cifrar. La API solo descifra estas imágenes para el rider dueño o un administrador autorizado.

Después de crear una copia de seguridad y configurar esa clave en Render, cifre los registros heredados desde una shell de Render:

```sh
pnpm --filter @motoya/api media:encrypt-legacy
```

Ejecute este comando una sola vez por base de datos. Si encuentra una imagen antigua inválida, se detiene sin registrar el contenido de la evidencia: corrija ese registro bajo el proceso administrativo y vuelva a ejecutarlo.

## 3. Respaldo y restauración

`Production database backup` crea a diario un `pg_dump` de formato custom, lo verifica con `pg_restore --list` y lo sube cifrado con una clave KMS a S3. Antes de activarlo, cree un entorno protegido de GitHub llamado `production` y configure:

| Tipo | Nombre | Uso |
| --- | --- | --- |
| Secret | `PRODUCTION_DATABASE_URL` | Cadena de conexión exclusiva para respaldos, con privilegios mínimos de lectura. |
| Secret | `BACKUP_AWS_ROLE_ARN` | Rol OIDC de GitHub con permiso limitado al bucket y a la clave KMS. |
| Variable | `BACKUP_AWS_REGION` | Región de AWS del bucket. |
| Variable | `BACKUP_BUCKET` | Bucket privado de respaldos. |
| Variable | `BACKUP_KMS_KEY_ID` | Identificador de la clave KMS de cifrado. |

En S3 establezca una política de ciclo de vida: conservar 35 respaldos diarios, 12 mensuales y borrar los demás. Limite el bucket al rol de respaldo y al rol de restauración; no use ACL pública.

Pruebe cada mes una restauración en una base de datos vacía y aislada:

```sh
pg_restore --clean --if-exists --no-owner --dbname "$RESTORE_DATABASE_URL" motoya-postgres-AAAA-MM-DD.dump
```

No restaure sobre producción. Registre la fecha, responsable y resultado de cada simulacro.

## 4. Operación continua

- Rote los secretos al menos cada 90 días y ante cualquier sospecha de filtración; invalide las sesiones existentes cuando rote secretos JWT.
- Revise semanalmente los fallos de CI, los errores de Render y las cuentas administrativas.
- Mantenga las dependencias con `pnpm audit --prod` y actualice dependencias de seguridad con una pull request validada por CI.
- Antes de cada despliegue, ejecute localmente: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
