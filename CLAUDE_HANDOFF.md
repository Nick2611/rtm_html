# Handoff centralizado para Claude

Última actualización: 2026-08-13

## Estado al 2026-08-13 (segunda sesión) — se ejecutó C1–C6 en código

Todo lo que quedaba en "Cambios de código pendientes" está **hecho y verificado en navegador real**.
Nada commiteado: el dueño revisa. Debajo, lo que cambió, lo que se descartó y lo único que sigue
abierto.

### Corrección importante sobre la sesión anterior

**RTM no alquila.** Se había propuesto meter "Alquiler" en el H1 por message match con las keywords
de Ads, y el dueño lo corrigió en el momento: RTM **fabrica, vende e instala**. Las keywords de
alquiler las corrige él del lado de Ads. El H1 quedó en **"Fabricamos e instalamos pantallas LED
para eventos, comercios y empresas"**, que es el diferencial real frente a un importador o un
revendedor. Título, meta description, OG, Twitter y el `description` de schema.org quedaron **como
estaban**, sin tocar. Ojo: "Sistemas rental para eventos y giras" sigue en Nosotros y en Servicios;
es copy del dueño sobre la línea Tour Series (equipos de grado rental que se venden), no una oferta
de alquiler.

### C1 — Clarity con guard de hostname · HECHO

Los 12 HTML (incluidos `servicios.html`, `proyectos.html` y los cinco de `seccion_servicios/`, que
el handoff anterior no listaba) cargan Clarity sólo si
`/(^|\.)pantallasledrtm\.com$/i.test(location.hostname)`. Se aceptan apex y subdominios; quedan
afuera local, previews y `file://`. `emitClarityEvent` ya devolvía false en silencio sin `clarity`,
así que no hay ruta rota.

### C2 — `transport_type: 'beacon'` · HECHO

`GTAG_TRANSPORT` en `js/conversion-tracking.js`, aplicado en `emitAdsConversion` **y** en
`emitGa4Event`, siempre después del spread del contexto para que nada lo pise. `ga4Params` ahora
reserva **dos** lugares de los 25 (`send_to` + `transport_type`), no uno; sin ese ajuste el evento
se pasaba del límite de GA4 y GA4 lo descarta en silencio.
**La hipótesis del beacon sigue sin probarse.** Se confirma mirando si el canal "Unassigned"
desaparece de los `whatsapp_click` después de desplegar.

### C3 — `404.html` · HECHO

Tiene gtag (Ads + GA4), `body data-page="404"` y `conversion-tracking.js`. El script se referencia
como **`/js/conversion-tracking.js`, ruta absoluta**: el servidor devuelve este archivo para
cualquier URL, así que una ruta relativa se rompe en cuanto el 404 se sirve desde `/algo/profundo/`.
Los cinco enlaces de recuperación emiten `recovery_404` con el destino en `placement`, para saber
por dónde se rescata el que aterriza mal.

### C4 — `privacidad.html` · HECHO

Se agregó gtag. Antes cargaba `conversion-tracking.js` sin etiqueta, así que las dos `emit*`
devolvían false en silencio y sólo funcionaba Clarity.

### C5 — `tel:` y `mailto:` · HECHO

Los **9 de 9** anclas tienen `data-conversion` (verificado parseando el marcado, no con grep de una
línea: cuatro quedan con el atributo en el renglón siguiente). Se agregaron al módulo las reglas de
prefijo `phone_` → `phone_click` y `email_` → `email_click`, y `inferChannel` ahora clasifica
`tel:` como `phone` y `mailto:` como `email`. **Sólo viaja la palabra del canal**, nunca el número
ni la dirección; hay un test que lo afirma. No disparan conversión de Ads porque no existe acción
creada para esos canales — si se quiere contarlos como conversión, hay que crearla en Ads primero.

### C6 — hero de `index.html` · HECHO (`cro` + `offers`)

De los cuatro levers de la ecuación de valor, el que estaba peor era **esfuerzo**: para enterarse de
algo había que abrir un chat con un desconocido. Los tres cambios atacan eso:

1. **El mensaje de WhatsApp del hero viene prellenado con los tres datos con los que se cotiza**
   (dónde va / medida aproximada / para cuándo). Antes abría un chat en blanco, y de 8 taps salieron
   6 chats y ~3 consultas genuinas. Se cambió **sólo el del hero**, a propósito: el flotante y el del
   header siguen con su mensaje corto, así se puede comparar.
2. **CTA secundario `#proyectos` → `productos.html`** (`data-conversion="catalog_hero"`, mapeado a
   `content_cta_click`). El ancla anterior no podía mover las 1,13 páginas por sesión ni contestar
   "qué equipo necesito". El catálogo con fichas técnicas es lo único que el sitio puede dar **antes**
   de pedir una conversación.
3. **Fila de prueba `.hero__proof`**, con hechos que el sitio **ya afirmaba** más abajo: fabricación
   e instalación propias en Florencio Varela, los clientes del carrusel nombrados, y los 34 modelos
   con ficha. Va **debajo de los botones** a propósito, para no correr el CTA fuera del fold en una
   página que es 98 % móvil. El carrusel de logos sigue apareciendo una sola vez (AGENTS.md §3): esto
   es texto, no logos.

**Lo que NO se hizo, y por qué:** no se agregó promesa de tiempo de respuesta ni rango de precio.
Las dos son las piezas que más levantarían la conversión, y las dos son datos del dueño: inventarlas
viola AGENTS.md §5. **Es lo primero que hay que pedirle.**

### C7 — defecto encontrado al verificar: el `placement` estaba colapsado · CORREGIDO

No estaba en la lista y es el hallazgo más importante de la sesión. `getElementContext` leía
`placement` de `['conversionPlacement', 'context']`, y los cinco CTAs del home llevan
`data-context="home"`: el clic del hero, el del header, el del menú y el flotante llegaban los cuatro
como **`placement: "home"`**. Peor, `js/main.js:245` le escribe el pathname al flotante, así que ese
reportaba `placement: "/index.html"`. Es decir: **no había forma de saber qué botón gana la
consulta**, que es exactamente la pregunta de esta etapa.

Ahora `placement` sale sólo de `data-conversion-placement`; si no hay atributo explícito gana el
emplazamiento que implica el nombre del evento vía `canonicalEvent`. `data-context` sigue viajando,
como `section`. **No se pierde nada**: en cada elemento donde `data-context` traía un emplazamiento
real (`model-detail`, `special-footer`, `catalog-footer`, `catalog-persistent`) el mismo valor ya
venía en `data-conversion-placement` — `js/products.js` escribe los dos.

Verificado en navegador: los cuatro CTAs del home ahora emiten `hero`, `header`, `menu_mobile` y
`floating`, distintos. Nota: esto **parte la serie de Clarity** de `rtm_placement`, pero lo que había
antes era un único valor colapsado, o sea que no se pierde información real.

### Verificación ejecutada (2026-08-13)

- `node --check` sobre todo `js/` y `backend/lambda/send-email/`: correcto.
- `node --test js/conversion-tracking.test.js backend/lambda/send-email/validation.test.js`:
  **45/45** (eran 39; se agregaron 6 pruebas: beacon en las dos emisiones, contexto que no puede
  pisar `transport_type`, taxonomía `phone_`/`email_`, canal sin PII, `tel:`/`mailto:` que no
  disparan Ads, y `data-context` que no pisa el placement).
- `git diff --check`, `git ls-files -u`, marcadores de conflicto, `git ls-files bi`: todo limpio.
- **Navegador real** (Chrome headless nuevo vía CDP con `mobile:true`, que sí respeta
  `<meta viewport>`): `index`, `productos`, `guia`, `proyectos`, `servicios`, `privacidad` y `404` a
  **1440 / 900 / 700 / 600 / 390 / 375 / 360 / 320 px**. Sin overflow horizontal en ninguno. Los 8
  elementos fuera de caja de `servicios.html` a 1440 px son el dropdown oculto del nav y son
  **idénticos a la baseline de HEAD** — no es una regresión.
- **Los dos CTAs del hero siguen arriba del fold en todos los tamaños** (el peor caso es 320×568:
  el secundario termina en 548). El CTA primario bajó de 352 a 458 px en 375×667 por el subtítulo
  más largo, y sigue holgadamente visible.
- **Tracking probado con clics reales** (gtag espiado, sin navegar): hero, header, menú móvil,
  flotante, `tel:` del footer y tarjeta de servicios. Los seis emiten con `transport_type: beacon`,
  el `send_to` correcto y el `placement` correcto.
- **Formulario probado sin enviar nada**: valida limpio, `form_start` emite con beacon, el submit se
  interceptó y `fetch` se bloqueó. Los únicos requests salientes fueron los propios de gtag.
- Versiones de assets: `main.css?v=20260813-hero1` y `conversion-tracking.js?v=20260813-beacon1` en
  todas las páginas. La Lambda **no** se tocó, así que `send-email.zip` no se regeneró.

### Lo único que sigue abierto

1. **Pedirle al dueño el tiempo de respuesta y un rango de precio orientativo.** Es la palanca de
   conversión más grande que queda y no se puede inventar.
2. **GA4 sigue sin guard de tráfico local, y eso es deliberado.** Se comprobó en vivo: desde
   `localhost:8123` gtag manda requests a `pagead/form-data`, `ccm/form-data` y `rmkt/collect` de
   Google. Se dejó así porque guardarlo impediría verificar el tracking localmente — que es
   exactamente lo que permitió encontrar C7. **El arreglo correcto es del lado de la propiedad**:
   filtro de tráfico interno + exclusión de IP en GA4 Admin. Hacerlo.
3. **`js/main.js:245`** le escribe el pathname al botón flotante (`context.pathname`). Desde C7 eso
   ya no rompe el `placement`, pero deja `section: "/index.html"`, que es ruido. Cosmético.
4. Sigue pendiente la verificación de Ads del handoff anterior: si Google rellenó hacia atrás la
   columna *Conversions* del 9 al 12 de agosto.

## Estado al 2026-08-13 — sesión de ads / analytics / marketing

Esta sesión **no tocó código**. Fue diagnóstico sobre Google Ads, GA4 y Clarity, y todos los cambios
se aplicaron en la cuenta de Ads por el dueño. Lo que queda para la próxima sesión es trabajo de
código y de página. El detalle de la cuenta vive en la memoria del proyecto; acá va sólo lo que
afecta al repositorio.

### El número que ordena todo lo demás

**395 clics de Ads → 8 taps de WhatsApp registrados → 6 chats reales → ~3 consultas genuinas → 0
cerradas.** Gasto del 1 al 12 de agosto: **ARS 366.392**. Eso es **0,76 % de clics que terminan en
una consulta real** y ~ARS 122.131 por consulta. La cuenta de Ads ya está saneada (keywords, negativas,
objetivos de conversión, grupos de anuncios); **el cuello de botella ahora es la página, no la
pauta**. Tráfico pagado: 1,13 páginas por sesión, 34 % de scroll, ~15 s activos, 98 % móvil.

### Lo que la próxima sesión debe leer y usar

**Usar estas skills del proyecto para la auditoría de página, en este orden:**

1. **`cro`** — la palanca más grande que queda. 1,13 páginas por sesión y un formulario que empieza
   por debajo del 34 % de scroll es un problema de landing, y cuesta más que el gasto desperdiciado
   en anuncios. Ojo: **el CTA de WhatsApp ya está arriba del fold** (el botón `btn--primary` que dice
   "Pedir cotización" en `index.html` es un enlace `wa.me`, no un ancla al formulario), así que **no
   es un problema de ubicación del CTA** — es de mensaje, prueba y oferta.
2. **`attribution`** — para el beacon de `whatsapp_click` y el canal "Unassigned" de GA4 (ver C2).
3. **`offers`** — dar algo antes de pedir: rango de precio, promesa de tiempo de respuesta, garantía.
   Es construcción de oferta, no redacción.

Contexto adicional en `marketing-council`, `ads` y `analytics`, ya usadas en esta sesión.

### Cambios de código pendientes, por prioridad

**C1 — Excluir el tráfico local de Clarity.** El snippet de Clarity (`index.html:100-105`, y el mismo
bloque en `productos.html`, `guia.html`, `404.html`, `privacidad.html`) se carga sin condición.
El 2026-08-12, **42 de 119 sesiones (35 %) vinieron de `127.0.0.1:5500` y `localhost:8000`**, incluida
una a `_tmp_old.html`. Eso contamina todos los agregados: "PC" muestra 4,13 páginas por sesión, y en
su mayoría es el propio desarrollador. Envolver el snippet en un guard de hostname
(`location.hostname === 'pantallasledrtm.com'`) o excluir la IP desde el panel de Clarity.

**C2 — `transport_type: 'beacon'` en las dos emisiones a gtag.** En
`js/conversion-tracking.js`, `emitAdsConversion` (línea ~450) y `emitGa4Event` (línea ~503) llaman a
`gtag('event', …)` sin `transport_type` ni `event_callback`. `handleDelegatedClick` no hace
`preventDefault`, así que el navegador se va a `wa.me` con los requests todavía en vuelo. En móvil
—que es el **98 % del tráfico pagado**— el salto a la app de WhatsApp manda el navegador a segundo
plano y el request se pierde. Evidencia: el 2026-08-12 Ads registró 3 `WhatsApp - clic` y GA4 sólo
2 `whatsapp_click`, ambos con canal **"Unassigned"** y sesiones de 0,0002 s. `navigator.sendBeacon`
(que es lo que activa `transport_type: 'beacon'`) sí está garantizado al descargar/segundo plano.
Nota: el orden de scripts **no** es el problema — `gtag('config', …)` corre en el head
(`index.html:109-115`) y `conversion-tracking.js` carga con `defer` (línea 549). La hipótesis del
beacon es consistente con los datos pero **no está probada**; confirmarla mirando si "Unassigned"
desaparece después del cambio.

**C3 — `404.html` no tiene gtag ni carga `conversion-tracking.js`.** Cero coincidencias de `gtag` en
ese archivo. Las páginas de error son invisibles para GA4 y Ads, así que no hay forma de saber si
tráfico pagado está aterrizando en 404s.

**C4 — `privacidad.html` carga `conversion-tracking.js` pero no tiene gtag.** Las dos funciones
`emit*` chequean `typeof gtagFn !== 'function'` y devuelven `false` en silencio, así que ahí sólo
funciona Clarity. Decidir: agregar gtag, o aceptarlo y documentarlo.

**C5 — 9 enlaces `tel:` y `mailto:` sin `data-conversion`.** Cero de los nueve están trackeados.
Son contactos que no se cuentan en ningún sistema.

**C6 — La página no da nada antes de pedir.** El hero tiene título, subtítulo y dos botones: ni
rango de precio, ni prueba social, ni promesa de respuesta, ni instalaciones hechas. El visitante
que buscó `alquiler pantallas led para eventos precios` tiene que abrir un chat con un desconocido
para averiguar un precio. Trabajo para `cro` + `offers`.

### Lo que NO hay que volver a hacer

- **No proponer dividir la campaña en varias.** Se evaluó y se descartó: con ARS 30.090/día y
  **79,9 % de impresiones perdidas por presupuesto**, tres campañas son tres presupuestos que no se
  prestan entre sí. El conflicto de negativas se resuelve con **negativas a nivel grupo de anuncios**.
- **No proponer cambiar la estrategia de puja.** Sigue en `TARGET_SPEND` (Maximize clicks) con techo
  de CPC de ARS 13.000, y está bien así. Todas las keywords tienen `cpc_bid_micros: 0`
  (efectivo **ARS 0,01**), así que pasar a Manual CPC hoy **frena la entrega**. Revisar recién con
  15–30 consultas reales atribuibles, y nunca pasar a Maximize Conversions mientras la señal
  registrada (taps) sobreestime la realidad 2,7×.
- **No agregar `interior`, `luces`, `luz` ni `focos` como negativas y volver a sacarlas.** Estado
  correcto actual: `interior`/`luces`/`luz` **fuera** (bloqueaban `pantalla led interior` y el propio
  set de iluminación profesional); `foco`/`focos` **dentro**, a nivel campaña, porque **RTM no vende
  focos** — decisión del dueño, no revisarla.
- **No volver a derivar el estado de la cuenta desde métricas.** Leer el estado real con
  `google-ads-mcp` en el mismo turno en que se escribe la recomendación. En esta sesión se
  recomendaron tres cosas ya configuradas.

### Verificación pendiente

Chequear si Google rellenó hacia atrás la columna *Conversions* del 9 al 12 de agosto después de que
se pasara `CONTACT`/`WEBSITE` a `biddable: true` el 2026-08-12. Si siguen en 0, la línea base de
conversiones arranca en la fecha del cambio, no en el lanzamiento de la campaña.

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
