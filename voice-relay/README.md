# voice-relay

Relé de voz del piloto de certificación Fernanda LatAm — ver
`docs/specs/paciente-voz-latam/` en la raíz del repo (spec completo) y
`.claude` memory `project_piloto_voz_fernanda_latam.md` para el estado
general del piloto.

**Por qué existe:** una prueba real (2026-09-25) confirmó que el enfoque
liviano (WebRTC directo navegador↔OpenAI + canal `sideband` de control) no
puede cerrar la sesión desde el servidor para la Realtime API clásica — el
audio del navegador siguió sin cortes durante 4 intentos distintos de
cierre. Este servicio resuelve eso siendo dueño de la única conexión real a
OpenAI: el navegador le habla a él (WebSocket), nunca a OpenAI directo, así
que cerrar la conexión de este lado sí termina la sesión de verdad.

## Correr localmente

```bash
cp .env.example .env      # completar los valores
npm install
npm run dev                # VOICE_PROVIDER=simulated por default: sin costo
```

`VOICE_PROVIDER=real` conecta a la Realtime API de verdad — gasta. Antes de
usarlo, doble-chequear los nombres de evento contra la documentación
vigente de OpenAI (ver el comentario en `server.js` sobre `createRealProvider`
— no se re-verificaron en vivo para este incremento, solo el proveedor
simulado se probó de punta a punta).

## Deploy (Render)

Blueprint declarativo en `render.yaml` (raíz del repo, no acá — Render lo
busca ahí), con `rootDir: voice-relay` para que el build/start corran solo
sobre este subdirectorio del monorepo (el resto de `gloriapp` sigue en
Vercel, sin tocar). Mismo patrón que ya usa `gather` (Mundo UGM) del
usuario, otro servicio Node persistente en Render.

En Render: **New +** → **Blueprint** → conectar el repo `gloriapp` → Render
detecta `render.yaml` solo. Los secretos (`sync: false` en el blueprint) se
completan a mano en el dashboard, nunca en el repo: `OPENAI_API_KEY` (la
misma que usa `gloriapp`) y `VOICE_RELAY_SHARED_SECRET` (generar uno nuevo,
ej. `openssl rand -hex 32` — el MISMO valor va después en Vercel).

(Railway quedó descartado para este piloto: el trial de la cuenta del
usuario venció y requería elegir un plan pago antes de poder crear un
proyecto — se optó por Render, cuenta ya activa.)
