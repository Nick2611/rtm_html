# Handoff centralizado para Claude

Última actualización: 2026-08-12

## Estado al 2026-08-12 (revisión de lo que dejó Codex + cierre de la fase dashboard)

Resumen corto: la fase del dashboard está **terminada y verificada**. Se encontró y corrigió un
defecto bloqueante en el trabajo de GA4 event-context, y una regresión responsive en el catálogo.
Nada está commiteado todavía; sigue pendiente decidir remote y hacer el commit.

**1. Defecto bloqueante corregido — GA4 pedía las dimensiones personalizadas con el nombre
equivocado.** `GA4_REPORT_FIELDS` pedía `action`, `category`, … y la Data API responde a
`customEvent:action`. No es una degradación: devuelve `400 Field action is not a valid dimension` y
**se pierde el reporte entero**. Los dos slices de contexto habrían gastado 2 de los 8 requests
diarios para un 400 garantizado, en cada corrida. Verificado en vivo contra la propiedad antes y
después. La corrección vive en `bi/packages/contracts/src/ga4.ts`
(`ga4CustomDimensionName`, `GA4_EVENT_CONTEXT_DIMENSIONS`) y el transform traduce de vuelta al
nombre corto para guardar. Por qué no lo agarró ningún test: todos construían los headers de la
respuesta **desde la misma constante** que después validaban, así que un nombre mal escrito
coincidía consigo mismo. Los tests nuevos usan literales copiados del endpoint de metadata.

**2. La fase del dashboard quedó cerrada.** Migration `0018_event_context_mart.sql` expone el fact
nuevo en `mart` (`v_event_context_daily` con el gate `context_measured`, y
`v_event_context_param_daily` en formato largo que **abre en abanico** y hay que filtrar por `param`
antes de sumar). `/behavior` tiene un panel nuevo. Las seis rutas responden 200 contra el almacén
real y el build de producción pasa.

**3. Hoy no hay contexto en los datos, y es un hecho de despliegue, no de conducta.** Los únicos
eventos que llegan a GA4 son los automáticos; `emitGa4Event` de `js/conversion-tracking.js` no está
commiteado, por lo tanto no está desplegado. El panel lo dice explícitamente y se llena solo cuando
se despliegue: no hay nada más que tocar en el almacén.

**4. Regresión responsive corregida en el catálogo.** El bloque `@media (max-width: 1000px)` que
agregó Codex quedó **después** del de 768 px. Con igual especificidad gana el último, así que su
`max-width: 100%` pisaba el `max-width: 560px` con el que las tarjetas se centran en pantallas
chicas. Medido en navegador con archivos reales: a 700 px la tarjeta se iba a 645 px a lo ancho en
vez de 560 px. Se movió el bloque antes del de 768 px (orden de más ancho a más angosto) y se
verificó a 1440 / 900 / 700 / 600 / 390 px, sin overflow horizontal en ninguno. `productos.html`
quedó versionado como `20260812-responsive3`.

**5. Dos imágenes staged no las referencia nadie.** `imagenes_productos/pisos_led/P60DISCO.webp` y
`imagenes_productos/iluminacion_profesional/3_en_1/cmr_400_led/cmr400-2.webp` no aparecen en
`data/products.json` — el catálogo usa `P60DISCO-2/-3.webp` y `cmr_400-2.webp` (con guión bajo).
Son ~105 KB muertos. **Decisión del dueño del sitio**: sacarlas del commit, o referenciarlas si la
intención era reemplazar la imagen principal. No se tocaron.

Nota sobre una afirmación del handoff anterior: decía "40 productos". El conteo real es **34
modelos** (56 ids en total contando categorías y subcategorías). Sin IDs duplicados, y las 101
referencias a assets existen y están todas trackeadas en git — no hay 404s esperables al desplegar.

Este archivo es el punto único de continuidad entre agentes. No contiene secretos, tokens,
credenciales ni valores sensibles. Debe actualizarse al terminar cada bloque de trabajo relevante.

## Alcance y reglas

- Repositorio principal: `/Users/nicolasmendez/Documents/GitHub/rtm_html`.
- Repositorio BI separado: `/Users/nicolasmendez/Documents/GitHub/rtm_html/bi`.
- Leer `AGENTS.md` completo antes de editar.
- Preservar cambios existentes. No usar `git reset --hard`, `git checkout --` ni force push.
- Mantener `bi/` fuera del índice del repositorio principal.
- No agregar `.env`, `secrets/`, credenciales, tokens, claves privadas, builds ni datos locales.
- Antes de cada commit revisar `git diff` y `git diff --cached`; después revisar estado y remotos.

## Repositorio principal

Estado conocido:

- Branch actual: `main`.
- No había remote configurado al iniciar esta tarea. Falta verificar el repositorio correcto
  `Nick2611/rtm_html` antes de agregarlo.
- Los conflictos de `data/products.json` y `js/products.js` fueron resueltos comparando stages
  ours/theirs. La versión final conserva la implementación moderna, cache-busting y assets WebP
  de ours, y agrega los modelos válidos que sólo existían en theirs.
- Después de resolver los conflictos, `git ls-files -u` devolvió cero resultados. Repetir esa
  comprobación antes del commit.
- `data/products.json` contiene 40 productos, sin IDs duplicados y sin referencias de assets
  inexistentes según la validación ejecutada. Las nuevas fotos existentes conservan sus formatos;
  no se hizo conversión indiscriminada.
- `js/products.js` conserva carga versionada del catálogo, lazy loading para media no crítica,
  dimensiones de imagen y escaping de contenido dinámico.
- La validación visual con navegador confirmó escritorio a 1440 px y móvil a 390 px. El catálogo
  quedó sin overflow horizontal; se agregó un breakpoint de catálogo alineado al breakpoint móvil
  del header y se versionó `css/products.css` como `20260811-responsive2`.
- Los cambios acoplados de formulario/Lambda ya estaban en el working tree y deben revisarse
  juntos: `js/contact-form.js`, `backend/lambda/send-email/send-email.js`,
  `backend/lambda/send-email/validation.js`, `backend/lambda/send-email/lead-store.js` y el ZIP.
  Si se modifica la Lambda, regenerar `backend/lambda/send-email/send-email.zip` y validarlo.
- El archivo `rtm_html.code-workspace` apareció como no trackeado y debe quedar fuera del commit
  salvo que se demuestre que es infraestructura asociada a la página.

Validaciones ya ejecutadas (todas re-corridas el 2026-08-12):

- `node --check` sobre los JS modificados: correcto.
- `node --test js/conversion-tracking.test.js backend/lambda/send-email/validation.test.js`:
  39 tests, 39 correctos.
- `git diff --check` y `git diff --cached --check`: sin observaciones.
- `git ls-files -u` vacío; sin marcadores de conflicto en `js/`, `css/`, `data/`, `backend/`, HTML.
- `git ls-files bi` vacío: el repo padre no incluye nada de `bi/`.
- `data/products.json`: 56 ids únicos, 0 duplicados, 101 referencias a assets, 0 faltantes y 0
  untrackeadas.
- Validación visual real en navegador a 1440 / 900 / 700 / 600 / 390 px sobre `productos.html`
  servido localmente: sin overflow horizontal en ninguno, y el tope de 560 px restaurado.
- La Lambda **no** se modificó en esta sesión, así que `send-email.zip` no se regeneró (la regla de
  regenerarlo sigue vigente para cualquier cambio futuro en `backend/lambda/send-email/`).
- El formulario sólo debe probarse localmente sin enviar una consulta real.

Pendiente en el repositorio principal:

1. Revisar todos los cambios staged/unstaged y separar assets de página de archivos personales.
2. Verificar `.gitignore` para excluir `/bi/` y cualquier secreto.
3. Repetir `git ls-files -u`, búsqueda de marcadores de conflicto, `git diff --check` y checks de
   sintaxis/tests.
4. Verificar `js/contact-form.js` contra la Lambda y el contenido del ZIP; regenerar sólo si la
   Lambda cambió.
5. Confirmar remote/branch y crear `Nick2611/rtm_html` sólo si el remote no existe y se verifica
   que es el repositorio correcto.
6. Commit descriptivo y push a `main`, sin force push. No afirmar éxito si el comando falla.

## Repositorio BI privado

Estado conocido:

- `bi/` es un repositorio Git anidado, branch `main`, y no está trackeado por el repositorio padre.
- No tenía remote al iniciar la tarea. Falta verificar con `gh` la cuenta `Nick2611` y usar o crear
  el repositorio privado `Nick2611/rtm-bi`, sin duplicados.
- El scheduler ya contempla Clarity, GA4, Ads y leads. GA4 corre con ocho requests: seis reportes
  base y dos reportes de contexto para las ocho dimensiones custom. Verificado en vivo: 8/8.
- La implementación de GA4 agrega dos grains no joinables en JSONB (`event-context-a-daily` y
  `event-context-b-daily`), manteniendo como máximo nueve dimensiones por request. No unir ambos
  grains por `eventName`; conservar el objeto de dimensiones y sus métricas en cada grain.
- **Las dimensiones custom se piden como `customEvent:<parámetro>`, nunca con el nombre pelado.**
  Con el nombre pelado la API tira 400 y se pierde el reporte completo. `ga4CustomDimensionName()`
  es el único lugar que traduce; el almacén guarda el nombre corto.
- Se agregó migration nueva `packages/db/migrations/0017_ga4_event_context.sql`, contratos,
  transform, loader, plan, scheduler y tests. La migration histórica `0008` debe permanecer
  inmutable; su comentario fue restaurado.
- `packages/db/migrations/0018_event_context_mart.sql` expone el fact en `mart`. Ojo con
  `v_event_context_param_daily`: **abre en abanico**, repite la métrica en cada parámetro de la
  fila, y hay que filtrar por un solo `param` antes de agregar.
- Revisar y reforzar `bi/.gitignore` para cubrir `.env`, `.env.*`, `secrets/`, credenciales,
  claves privadas, `node_modules`, builds y datos locales.

Validaciones BI (2026-08-12, con el Postgres local arriba — el bloqueo anterior era el entorno,
no el código):

- `pnpm -r typecheck`: sin errores en contracts, db, dashboard y ETL.
- `pnpm -r test`: **818/818**, sin fallos. contracts 197, db 101, dashboard 24, ETL 506.
  Los 76 fallos anteriores eran falta de Postgres, no defectos.
- Se corrigió además un test viejo que ya fallaba antes de esta sesión:
  `runtime/config.test.ts` seguía esperando el mensaje de expiración de 7 días de OAuth, que ya no
  aplica porque la pantalla de consentimiento está publicada en Production. Ahora afirma la guía
  correcta.
- `pnpm db:migrate`: aplicó `0017_ga4_event_context.sql` y `0018_event_context_mart.sql`.
- `pnpm --filter @rtm/etl ga4:verify`: **8/8 reportes sanos** contra la API en vivo (no escribe en
  la base). Antes de la corrección, los dos slices de contexto devolvían 400.
- Ingesta + transform reales: 218 filas crudas, 438 filas de fact, 0 descartadas; 44 filas en
  `core.fact_ga4_event_context_daily`.
- `pnpm --filter @rtm/dashboard build`: compila; las seis rutas responden 200 contra el almacén.
- `git ls-files` en `bi/`: no hay `.env`, `secrets/`, service accounts ni `.pem` trackeados.

Pendiente BI:

1. Revisar el diff completo antes de commitear (`git -C bi diff`, `git -C bi diff --cached`).
2. Verificar autenticación `gh` como `Nick2611`, remote privado `Nick2611/rtm-bi`, commit y push
   exclusivamente desde `bi/`.
3. Archivos nuevos sin trackear en `bi/`: `packages/db/migrations/0017_ga4_event_context.sql`,
   `packages/db/migrations/0018_event_context_mart.sql`, `packages/db/src/ga4-event-context.test.ts`.

## Deployment y cierre

- No se desplegó frontend ni Lambda en este punto. Antes de hacerlo, localizar la documentación
  real de deployment y verificar credenciales disponibles sin imprimirlas. Si falta cualquiera,
  dejarlo explicitado en el informe final.
- El envío real del formulario queda siempre pendiente salvo autorización explícita; sólo hacer
  prueba sin envío.
- Al finalizar, registrar aquí hashes, mensajes, remotes, branches, resultados de tests y cualquier
  archivo no commiteado o acción manual pendiente.

## Comandos de reanudación seguros

```sh
git status --short --branch
git diff --stat
git diff --cached --stat
git diff --check
git ls-files -u
rg -n '^(<<<<<<<|=======|>>>>>>> )' --glob '!CLAUDE_HANDOFF.md'
node --check js/products.js
node --check js/contact-form.js
node --check js/conversion-tracking.js
node --test js/conversion-tracking.test.js backend/lambda/send-email/validation.test.js
git -C bi status --short --branch
git -C bi diff --stat
git -C bi diff --cached --stat

# El BI necesita el entorno cargado: los procesos leen process.env, no leen .env solos.
cd bi && set -a && source .env && set +a
pnpm -r typecheck
pnpm -r test                       # 818/818 con el Postgres local arriba
pnpm db:migrate                    # idempotente
pnpm --filter @rtm/etl ga4:verify  # ~8 de 200.000 tokens diarios, no escribe en la base
pnpm --filter @rtm/dashboard dev   # http://localhost:3000
```

⚠️ Nunca apuntar un test o un script a `clarity.ms`: el presupuesto de Clarity es de 10 requests por
día y sólo sirve los últimos 1-3 días. GA4 y Ads no tienen esa restricción.
