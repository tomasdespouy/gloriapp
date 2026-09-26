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

## Deploy (Railway)

Conectar este directorio como "root directory" del servicio en Railway
(monorepo — el resto de `gloriapp` no es parte de este deploy). Variables
de entorno se configuran en el dashboard de Railway, nunca en el repo:
`OPENAI_API_KEY`, `VOICE_RELAY_SHARED_SECRET` (el mismo valor que
`gloriapp` tiene en su propio `.env.local`/Vercel), `VOICE_PROVIDER`.

Sin Dockerfile: Railway detecta Node vía Nixpacks a partir de
`package.json` (`npm install` + `npm start`), igual que el resto de los
servicios Node del usuario.
