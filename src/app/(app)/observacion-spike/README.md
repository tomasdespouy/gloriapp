# Spike — Eagle speaker recognition

Pantalla aislada para probar [Picovoice Eagle](https://picovoice.ai/platform/eagle/)
como reemplazo del walkie-talkie del módulo `/observacion`. Esta carpeta
es **experimental** — solo accesible vía URL directa por superadmin, no
aparece en sidebar.

## Para retomar después de la pausa

1. **Cambiar a la rama:**
   ```bash
   git checkout experiment/live-recording-eagle
   ```

2. **Re-descargar el modelo Eagle** (no se commitea por tamaño):
   ```bash
   curl -fL -o public/eagle_params.pv \
     https://raw.githubusercontent.com/Picovoice/eagle/main/lib/common/eagle_params.pv
   ```

3. **Conseguir AccessKey** en https://console.picovoice.ai/ (gratis,
   sin tarjeta).

4. **Levantar dev:**
   ```bash
   npm run dev
   # http://localhost:3000/observacion-spike
   ```

## Flujo de prueba

1. Pegar AccessKey → "Inicializar Eagle".
2. "Empezar enrollment": hablar normal 10–20s hasta llegar a 100%.
3. "Iniciar detección": el score (0–1) muestra qué tan parecido es el
   audio al enrollment. >0.5 = parecido a vos, <0.5 = otra voz.

## Qué decidir

- ¿Funciona la detección con voces reales del setup clínico?
- ¿Qué umbral de score usar (¿0.5? ¿0.6?) para decidir "es el observador"?
- ¿Cómo se comporta con voces parecidas (mismo género/edad/acento)?
- ¿Y con habla simultánea?

Si responde bien, **Etapa 2** = migrar `ObservacionClient.tsx` con
feature flag y dejar walkie-talkie como fallback. Si no, evaluar
alternativas (Resemblyzer server-side u otro).

## Archivos del spike

- `page.tsx` — guard de superadmin + render del cliente.
- `SpikeClient.tsx` — toda la lógica (audio + Eagle + UI).
- `public/eagle_params.pv` (no en git) — modelo de Eagle, 4.6 MB.

Dependencias agregadas: `@picovoice/eagle-web` y
`@picovoice/web-voice-processor` (`web-voice-processor` no se usa en
este spike pero queda instalado para Etapa 2).
