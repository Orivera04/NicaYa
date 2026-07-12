# Guía de contribución para MotoYa

## Antes de cambiar código

1. Lee `README.md` y `BEST_PRACTICES.md`.
2. Mantén la API como única autoridad para datos, permisos, precios y estados.
3. No incluyas secretos, `.env`, URLs privadas ni credenciales en Git.

## Cambios de backend

- Valida requests con Zod y aplica autorización por rol en cada endpoint privado.
- Toda modificación de Prisma requiere una migración, seed idempotente y revisión de índices.
- Las transiciones de viaje deben conservarse en el servicio y registrar historial.
- Nunca loguees contraseñas, tokens, URLs de conexión ni documentos de riders.

## Cambios de frontend

- Mantén la interfaz mobile-first y trata la API como fuente de verdad.
- Muestra errores comprensibles, estados de carga y estados vacíos.
- No expongas secretos mediante variables `NEXT_PUBLIC_*`.

## Verificación obligatoria

Ejecuta antes de un push: `pnpm lint`, `pnpm typecheck`, `pnpm test` y el build de los paquetes afectados. Si una verificación falla, documenta la causa y no la ocultes.
