# Buenas prácticas de MotoYa

## Arquitectura

- La API es la fuente de verdad. La web nunca accede a Prisma ni decide precios, roles o estados.
- Controladores/rutas validan y delegan; los servicios contienen reglas de viajes, precio y suscripción.
- `packages/shared` solo contiene contratos seguros para ambos lados. No exportar secretos ni modelos internos de Prisma.

## Código y carpetas

- TypeScript estricto, funciones pequeñas, nombres explícitos y sin `any`.
- Añadir módulos por dominio: ruta, servicio, validadores y pruebas correspondientes.
- Mantener componentes de interfaz reutilizables y mobile-first; no crear pantallas monolíticas.

## Seguridad y autenticación

- Validar toda entrada con Zod; el frontend mejora UX pero no es un límite de seguridad.
- Hashear contraseñas y refresh tokens. Nunca registrar credenciales, tokens o secretos.
- Aplicar `authenticate` y `authorize` en cada ruta privada. No aceptar rol, precio o usuario desde el cliente como autoridad.
- En producción: HTTPS, secretos gestionados, CORS explícito, cookies `httpOnly` para refresh y rotación de claves.

## Viajes, tiempo real y concurrencia

- Usar REST para mutar/leer; Socket.io solo notifica cambios tras una operación exitosa.
- Respetar la máquina de estados. Añadir una transición implica actualizar servicio, pruebas e historial.
- La aceptación debe conservar la condición `REQUESTED` y `riderId=null` dentro de una transacción. Nunca hacer "leer y luego actualizar" sin condición.
- En Fase 1 un rider debe estar aprobado, disponible y sin viaje activo; la suscripción vuelve a ser obligatoria solo al habilitar una fase posterior.

## Datos, migraciones y configuración

- Toda evolución de Prisma requiere migración versionada y seed idempotente.
- Tarifas y suscripción se leen de `SystemSetting`; no hardcodearlas.
- Validar entorno al arrancar y mantener `.env.example` actualizado. No commitear `.env`.

## Errores, logging y tests

- Mantener el formato `{ error: { code, message, details } }`; no exponer stack traces.
- Incluir `requestId` en logs estructurados y auditar acciones administrativas.
- Probar registro/login, roles, suscripción, aceptación doble, transiciones, cancelación y calificación antes de modificar el flujo.
- Ejecutar `pnpm lint`, `pnpm typecheck` y `pnpm test` antes de un commit.

## Operación y despliegue

- Configurar CORS exclusivamente con la URL pública de la web; nunca usar comodines en producción.
- Usar secretos distintos para cada entorno y rotarlos si se exponen en una conversación, captura o log.
- Mantener las migraciones en Git y aplicar `prisma migrate deploy` durante el arranque de la API.
- El plan gratuito de Render puede detener servicios inactivos; no debe considerarse infraestructura de producción.

## Ejecución

`docker compose up -d`, copiar variables de ejemplo, `pnpm install`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`.
