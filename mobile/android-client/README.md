# MotoYa Android

Proyecto Android Studio independiente para MotoYa. Está construido con Expo/React Native y contiene el proyecto nativo generado en `android/`, por lo que se puede abrir directamente en Android Studio.

## Abrir y compilar

1. Abre `/Users/orivera04/Workspace/Personal/NicaYaAndroid/android` en Android Studio.
2. Selecciona un emulador o dispositivo Android.
3. Ejecuta la configuración `app`.

Desde terminal:

```bash
cd /Users/orivera04/Workspace/Personal/NicaYaAndroid
pnpm install --ignore-scripts
cd android
./gradlew assembleDebug
```

El APK debug queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

Para generar un APK autónomo firmado con la clave debug de Android:

```bash
cd /Users/orivera04/Workspace/Personal/NicaYaAndroid
export NODE_ENV=production
cd android
./gradlew assembleRelease
```

El APK release queda en `android/app/build/outputs/apk/release/app-release.apk`. El wrapper `scripts/expo-cli-wrapper.cjs` mantiene el bundling de Expo/Metro en la raíz del proyecto para que la compilación desde Android Studio funcione también en release.

## Funcionalidad móvil

- Inicio de sesión y registro como pasajero o rider usando la API de MotoYa.
- Pasajero: permiso GPS, búsqueda de direcciones en Nicaragua, origen/destino, hasta tres paradas, instrucciones, estimación, tarifa propuesta, solicitud, ofertas/contraofertas, cancelación, seguimiento de estado/GPS, historial, calificación del rider y finalización con pago efectivo.
- Rider: estado disponible, GPS del dispositivo, solicitudes cercanas, aceptación o contraoferta, ruta de recogida, inicio del viaje, seguimiento, finalización, cobro en efectivo, historial y calificación del pasajero.
- La URL de API se configura en `app.json` (`expo.extra.apiUrl`).

La gestión administrativa permanece en la aplicación web y no se replica en Android.

La app usa el mismo contrato REST de la plataforma web. El proyecto nativo no incluye credenciales administrativas ni datos de gestión; el rider debe completar aprobación, documentos, zona y suscripción desde la web antes de conectarse.
