# MotoYa

MVP web de transporte en motocicleta. Separa una API global (Express + PostgreSQL) de la web (Next.js), para permitir una futura app móvil sin duplicar reglas de negocio.

## Arquitectura y decisión

Se usa **pnpm workspaces**, en vez de Turborepo, para que el MVP tenga el menor número de herramientas y comparta contratos mediante `@motoya/shared`. `apps/api` es la única capa que accede a Prisma; `apps/web` consume REST y Socket.io.

```text
apps/api       Express, Prisma, Socket.io, JWT
apps/web       Next.js App Router, Tailwind, React
packages/shared Tipos y esquemas Zod
```

El modelo incluye usuarios/perfiles, suscripciones, viajes, historial de estados, calificaciones, tokens de refresh, auditoría y ajustes configurables. La aceptación usa una actualización condicional dentro de una transacción: solo un rider puede aceptar un viaje `REQUESTED`.

## Requisitos e instalación

Node 20+, pnpm y Docker Desktop.

```bash
docker compose up -d
copy apps/api/.env.example apps/api/.env
copy apps/web/.env.example apps/web/.env.local
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Web: `http://localhost:3000`; API: `http://localhost:4000/health`.

En macOS/Linux usa `cp` en vez de `copy`. Cambia los secretos JWT antes de usar otro entorno.

## Scripts

`pnpm dev`, `pnpm dev:web`, `pnpm dev:api`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Credenciales de desarrollo

| Rol | Correo | Contraseña |
|---|---|---|
| Admin | admin@motoya.local | admin123 |
| Cliente | client@motoya.local | password123 |
| Rider activo | rider@motoya.local | password123 |

Solo son datos de desarrollo. El seed incorpora además un rider pendiente.

## Flujo funcional

1. Admin aprueba a un rider y activa una suscripción.
2. Rider se marca disponible.
3. Cliente calcula una estimación Haversine y solicita un viaje.
4. La API avisa mediante Socket.io a los riders elegibles; uno lo acepta atómicamente.
5. Rider avanza `ACCEPTED → RIDER_ON_THE_WAY → RIDER_ARRIVED → IN_PROGRESS → COMPLETED`.
6. Cliente puede calificar el viaje terminado y admin supervisa viajes/tarifas.

## Seguridad

Access token JWT, refresh token rotativo y almacenado como hash, contraseñas con bcrypt, validación Zod, Helmet, rate limit, CORS configurable, autorización por rol y errores sin stack trace. Para producción se recomienda refresh token en cookie `httpOnly`, un proveedor de secretos y HTTPS.

### Despliegue en Render

La API se publica en Render junto con PostgreSQL; la web se publica como un segundo servicio. Configura `DATABASE_URL`, secretos JWT únicos, `CORS_ORIGIN` con la URL exacta de la web y las variables `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_SOCKET_URL` en la web. `NEXT_PUBLIC_MAP_TILE_URL` es opcional: por defecto la web usa Carto Positron (`https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`) con atribución visible de OpenStreetMap y CARTO. Ejecuta migraciones con `prisma migrate deploy` antes de servir tráfico. Nunca reutilices credenciales o secretos compartidos por chat: rótalos inmediatamente desde Render.

### Fase 1 comercial

Durante captación, los riders aprobados reciben viajes sin suscripción obligatoria ni comisión. Las tarifas y la futura configuración de planes permanecen en `SystemSetting`; no se deben hardcodear. El registro de rider requiere cédula, licencia y vehículo, y debe pasar revisión administrativa antes de quedar disponible.

## Limitaciones del MVP

El selector de mapa muestra la experiencia y admite coordenadas/direcciones manuales; la abstracción de ubicación está preparada para integrar geocoding/rutas después. No incluye pagos reales, chat, GPS en segundo plano, push, rutas avanzadas ni app móvil nativa.

## Próximos pasos

Integrar un adaptador de geocodificación, Redis para rate limiting/eventos escalados, un proveedor de pago, pruebas de integración con PostgreSQL aislada y una app React Native que reutilice `@motoya/shared` y la API pública.
