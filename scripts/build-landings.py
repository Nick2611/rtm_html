#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera las ocho landings de categoría en productos/<slug>.html.

Las ocho páginas comparten cabecera, pie, dock y estructura de secciones, así que el HTML sale de
una sola plantilla en lugar de siete archivos copiados a mano. Las specs de cada modelo se leen de
data/products.json: no hay ninguna medida ni brillo escrito acá.

    python3 scripts/build-landings.py

CUIDADO: sobrescribe los siete archivos de productos/. Si se editó el HTML a mano, ese cambio se
pierde; lo que hay que editar es el diccionario CATEGORIES de este archivo, o css/landing.css si es
puramente visual.
"""

import json
import os
import html
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "productos")
DATA = json.load(open(os.path.join(ROOT, "data", "products.json"), encoding="utf-8"))
CATS_BY_SLUG = {c["slug"]: c for c in DATA["categories"]}

CSS_V = "20260813-landing2"
TRACK_V = "20260813-beacon1"
MAIN_JS_V = "20260805-conversion2"
MAIN_CSS_V = "20260813-dock1"

SPEC_LABELS = {
    "brilloPorM2": "Brillo",
    "brillo": "Brillo",
    "frecuenciaDeRefresco": "Refresco",
    "tamañoDelPanel": "Panel",
    "dimensionesDelDisplay": "Display",
    "dimensionesExteriores": "Exterior",
    "proteccion": "Protección",
    "tipo": "Tipo",
    "potencia": "Potencia",
    "lampara": "Lámpara",
    "leds": "LEDs",
    "acabadoSuperficial": "Superficie",
    "resistencia": "Resistencia",
    "efectos": "Efectos",
    "aplicacion": "Aplicación",
    "ruedaDeColores": "Colores",
    "ruedaDeGobosFija": "Gobos",
    "prisma": "Prisma",
    "prestaciones": "Prestaciones",
    "ruedaDeEfectoDeColores": "Efecto de color",
}

# Orden de preferencia de specs por categoria (se muestran hasta 3 filas, pitch incluido).
SPEC_ORDER = {
    "pantallas-led": ["brilloPorM2", "tamañoDelPanel"],
    "tour-series": ["tamañoDelPanel", "brilloPorM2"],
    "totems": ["dimensionesDelDisplay", "brillo", "brilloPorM2"],
    "pisos-led": ["tamañoDelPanel", "acabadoSuperficial", "tipo", "efectos"],
    "porticos": ["tamañoDelPanel", "brilloPorM2"],
    "soluciones": ["tamañoDelPanel", "tipo"],
    "iluminacion-profesional": ["tipo", "potencia", "lampara"],
}

WA = "https://wa.me/5491151531530?text="


def wa(msg):
    return WA + quote(msg, safe="")


def e(t):
    return html.escape(t, quote=False)


def ea(t):
    return html.escape(t, quote=True)


CATEGORIES = [
    {
        "slug": "pantallas-led",
        "cat": "pantallas-led",
        "nav": "Pantallas LED",
        "meta_title": "Pantallas LED para interior y exterior — Fabricación e instalación | RTM",
        "meta_desc": "Fabricamos, vendemos e instalamos pantallas LED de interior, exterior, "
                     "escenario y vehiculares. Definimos serie, pitch y medida según el lugar y el uso.",
        "h1": "Pantallas LED profesionales",
        "h1_span": "fabricación, venta e instalación",
        "lead": "Producimos, configuramos e instalamos cada sistema según el lugar donde va a "
                "funcionar, la distancia de visión y el uso diario que va a tener. No revendemos "
                "equipos genéricos.",
        "hero_image": "/proyectos_imagenes/proyecto_2.webp",
        "proof": [
            "Fabricación e instalación propias en Florencio Varela",
            "Series para interior, exterior, escenario y vehículos",
            "Repuestos y servicio técnico posteriores a la instalación",
        ],
        "wa_hero": "Hola, quiero cotizar una pantalla LED.\n\nDónde va: \nMedida aproximada: \nUso previsto: ",
        "wa_final": "Hola, quiero cotizar una pantalla LED.\n\nUbicación: \nMedida aproximada: \nUso previsto: ",
        "wa_dock": "Hola, estoy viendo pantallas LED y quiero asesoramiento para elegir la serie y el pitch.",
        "problem_title": "Comprar una pantalla LED sin saber qué se está comprando",
        "problem_lead": "La mayoría de las consultas que recibimos llegan del mismo punto: alguien "
                        "necesita una pantalla LED y se encuentra con una lista de precios sin criterio "
                        "técnico detrás. El resultado es previsible y caro.",
        "problems": [
            ("Pitch equivocado.", "Granulado de cerca, o pitch fino que desde la calle nadie nota."),
            ("Brillo insuficiente.", "Un panel de interior en un frente comercial queda ilegible al sol."),
            ("Instalación sin responsable.", "El equipo llega en cajas: estructura, carga y puesta en marcha quedan del lado del cliente."),
        ],
        "closing": "Para un comercio, un salón de fiestas o una empresa, la pantalla no es un gasto "
                   "decorativo: es un activo que tiene que funcionar todos los días, durante años, sin "
                   "supervisión técnica permanente. Una decisión mal tomada en la etapa de compra se "
                   "paga durante toda la vida útil del equipo.",
        "solution_title": "Un sistema definido para su aplicación, instalado y respaldado",
        "solution_lead": [
            "Primero definimos la aplicación —dónde va, desde qué distancia se mira, cuánta luz "
            "recibe— y recién después la serie, el pitch y el gabinete.",
        ],
        "series_labels": {
            "IFI960": "Serie IFI · Interior fija",
            "RI640": "Serie RI · Interior",
            "RI960": "Serie RI · Interior",
            "VP960": "Serie VP · Exterior fija",
            "RE640": "Serie RE · Eventos y escenario",
            "RE960": "Serie RE · Eventos y escenario",
        },
        "note": "También fabricamos la Serie Galileo (GIG / GIGO) para instalaciones profesionales que "
                "requieren una configuración específica, y la Serie Shell para vehículos, flotas y "
                "publicidad móvil, con actualización de contenido por Wi-Fi, USB o red 4G. "
                "Consultanos si tu proyecto entra en alguno de esos casos.",
        "steps": [
            ("Relevamiento y definición técnica", "Medidas, distancia de visión y consumo eléctrico antes de cotizar."),
            ("Fabricación e instalación", "Armado en la medida y el pitch definidos, con estructura y puesta en marcha a cargo nuestro."),
            ("Repuestos y servicio técnico", "Módulos, fuentes y placas disponibles después de la instalación."),
        ],
        "cta_title": "Solicitar una cotización",
        "cta_lead": "Indicanos la ubicación, la medida aproximada y el uso previsto. Devolvemos una "
                    "propuesta con serie, pitch, medida final y valor.",
    },
    {
        "slug": "tour-series",
        "cat": "tour-series",
        "nav": "Tour Series",
        "meta_title": "Tour Series — Pantallas LED para eventos y giras | RTM",
        "meta_desc": "Pantallas LED de gabinete liviano para eventos, escenarios y giras: 500×500 y "
                     "1000×500 mm, versiones curvas, indoor y outdoor con IP65 frontal.",
        "h1": "Pantallas LED para eventos",
        "h1_span": "montaje rápido y traslado permanente",
        "lead": "Gabinetes de aluminio y magnesio de 500×500 y 1000×500 mm, con versiones curvas e "
                "IP65 frontal para exterior. Fabricados para armarse, desarmarse y viajar.",
        "hero_image": "/proyectos_imagenes/proyecto_14.webp",
        "proof": [
            "Gabinetes de aluminio y magnesio con traba rápida",
            "Versiones curvas para escenarios no lineales",
            "Modelos indoor y outdoor con IP65 frontal",
        ],
        "wa_hero": "Hola, quiero cotizar una pantalla LED para eventos.\n\nMedida de escenario: \nInterior o exterior: \nFechas por año: ",
        "wa_final": "Hola, quiero cotizar una pantalla LED Tour Series.\n\nMedida de escenario: \nInterior o exterior: \nFechas por año: ",
        "wa_dock": "Hola, estoy viendo las Tour Series y quiero asesoramiento para elegir el gabinete y el pitch.",
        "problem_title": "Un panel de escenario que no aguanta el ritmo del armado",
        "problem_lead": "Una pantalla de evento se arma y se desarma decenas de veces por año, viaja en "
                        "camión y se monta contrarreloj. Los problemas no aparecen el día de la compra: "
                        "aparecen en el cuarto o quinto montaje.",
        "problems": [
            ("Peso y volumen.", "Un gabinete pesado suma gente, estructura y horas en cada fecha."),
            ("Panel de interior a la intemperie.", "Sin protección IP65 frontal, una lluvia termina el evento."),
            ("Sin repuestos a mano.", "Un módulo que tarda semanas deja la pantalla incompleta toda la gira."),
        ],
        "closing": "Para una productora o un proveedor de eventos, el equipo propio se paga con las "
                   "fechas que puede tomar. Cada hora de armado y cada panel fuera de servicio salen "
                   "del mismo lugar.",
        "solution_title": "Gabinetes pensados para el armado, no sólo para la imagen",
        "solution_lead": [
            "Definimos primero cómo se va a usar —escenario, medidas, si va al aire libre, cuántas "
            "fechas por año— y con eso elegimos gabinete, pitch y versión plana o curva.",
            "Todos los modelos usan gabinete de aluminio y magnesio fundido a presión con sistema de "
            "traba rápida.",
        ],
        "series_labels": {},
        "note": "Las versiones RIC y REC permiten ensamblados cóncavos y convexos. La RIF500 suma "
                "mantenimiento 100 % frontal por imanes, para pantallas montadas contra estructura o pared.",
        "steps": [
            ("Definición del sistema", "Medidas de escenario, interior o exterior y fechas previstas por año."),
            ("Fabricación y prueba de armado", "Montaje completo antes de entregar, para verificar juntas, alimentación y señal."),
            ("Repuestos y servicio técnico", "Módulos, fuentes y placas disponibles después de la entrega."),
        ],
        "cta_title": "Cotizar una pantalla de eventos",
        "cta_lead": "Contanos la medida del escenario, si va a usarse al aire libre y cuántas fechas por "
                    "año. Devolvemos una propuesta con serie, pitch, cantidad de paneles y valor.",
    },
    {
        "slug": "totems",
        "cat": "totems",
        "nav": "Tótems",
        "meta_title": "Tótems LED publicitarios para interior y exterior | RTM",
        "meta_desc": "Tótems LED de formato vertical para comercios, lobbies, shoppings y vía pública. "
                     "Indoor de alta definición y outdoor IP65 con vidrio laminado 3+3.",
        "h1": "Tótems LED verticales",
        "h1_span": "para comercios, lobbies y vía pública",
        "lead": "Formato vertical, contenido que se cambia sin imprimir nada y una construcción distinta "
                "según vaya adentro o a la intemperie. Fabricamos, instalamos y damos servicio.",
        "hero_image": "/proyectos_imagenes/proyecto_6.webp",
        "proof": [
            "Modelos de interior desde P1.53",
            "Exterior IP65 con vidrio laminado 3+3",
            "Versiones de simple y doble cara",
        ],
        "wa_hero": "Hola, quiero cotizar un tótem LED.\n\nDónde va: \nInterior o exterior: \nMedida aproximada: ",
        "wa_final": "Hola, quiero cotizar un tótem LED.\n\nUbicación: \nInterior o exterior: \nSimple o doble cara: ",
        "wa_dock": "Hola, estoy viendo tótems LED y quiero asesoramiento para elegir el modelo.",
        "problem_title": "Cartelería que envejece y no se puede cambiar",
        "problem_lead": "El tótem es lo primero que ve quien pasa por la puerta. Cuando el contenido es "
                        "impreso o el equipo no está preparado para donde se instaló, deja de cumplir esa "
                        "función a los pocos meses.",
        "problems": [
            ("Contenido fijo.", "Cada promoción nueva es reimprimir, coordinar y volver a instalar un gráfico."),
            ("Ilegible al sol.", "Un display de interior puesto en la vereda queda lavado todo el día."),
            ("Instalación sin responsable.", "Base, anclaje y alimentación eléctrica quedan del lado del cliente."),
        ],
        "closing": "Un tótem bien elegido cambia de mensaje todos los días y sigue funcionando años "
                   "después, sin volver a llamar a un instalador.",
        "solution_title": "El tótem se define por dónde se para y desde dónde se mira",
        "solution_lead": [
            "Definimos si va adentro o afuera, a qué distancia se lee, si necesita una o dos caras y "
            "qué medida entra. De ahí salen el modelo y el pitch.",
        ],
        "series_labels": {},
        "note": "Los modelos TE960 se fabrican en versión simple y doble cara, con vidrio laminado 3+3 y "
                "protección IP65 para instalación a la intemperie. Los TI son de interior y admiten "
                "pitch fino para lectura cercana.",
        "steps": [
            ("Relevamiento del punto", "Ubicación, distancia de lectura, luz ambiente y medidas disponibles."),
            ("Fabricación e instalación", "Armado en la medida y el pitch definidos, con base, anclaje y puesta en marcha."),
            ("Repuestos y servicio técnico", "Módulos, fuentes y placas disponibles después de la instalación."),
        ],
        "cta_title": "Cotizar un tótem LED",
        "cta_lead": "Indicanos dónde va, si es interior o exterior y la medida aproximada. Devolvemos una "
                    "propuesta con modelo, pitch, cantidad de caras y valor.",
    },
    {
        "slug": "pisos-led",
        "cat": "pisos-led",
        "nav": "Pisos LED",
        "meta_title": "Pisos LED para eventos, salones y pistas de baile | RTM",
        "meta_desc": "Pisos LED transitables para salones, discotecas y eventos: reproducción de video, "
                     "efectos RGB y superficie resistente al impacto y al agua.",
        "h1": "Pisos LED transitables",
        "h1_span": "para salones, pistas y escenarios",
        "lead": "Paneles que se caminan: video sobre el piso o efectos de luz, con superficie resistente "
                "al impacto y al agua. Fabricamos, instalamos y damos servicio.",
        "hero_image": "/proyectos_imagenes/proyecto_7.webp",
        "proof": [
            "PDANCE con acabado de vidrio templado de 10 mm",
            "Alta resistencia al impacto y al agua",
            "Modelos de video y de efectos RGB",
        ],
        "wa_hero": "Hola, quiero cotizar un piso LED.\n\nMedida de la pista: \nFijo o por evento: \nQué quiero mostrar: ",
        "wa_final": "Hola, quiero cotizar un piso LED.\n\nMedida de la pista: \nFijo o por evento: \nQué quiero mostrar: ",
        "wa_dock": "Hola, estoy viendo pisos LED y quiero asesoramiento para elegir el modelo.",
        "problem_title": "Una pista que tiene que aguantar la noche entera",
        "problem_lead": "El piso LED es el único equipo del salón que la gente pisa, tropieza y moja. La "
                        "diferencia entre un piso que dura años y uno que falla en la tercera fiesta está "
                        "en la construcción, no en el efecto.",
        "problems": [
            ("Superficie que no resiste.", "Sin acabado para tránsito, el panel se raya y pierde brillo en pocos eventos."),
            ("Sin protección contra líquidos.", "En un salón se vuelcan bebidas: falla justo donde más se usa."),
            ("Video y efecto, confundidos.", "Un piso que reproduce video y uno de efectos RGB no se eligen igual."),
        ],
        "closing": "Para un salón, la pista es un diferencial que se muestra en cada visita comercial. "
                   "Tiene que verse igual de bien en la fiesta número cien.",
        "solution_title": "El piso se elige por lo que va a mostrar y por cuánto se va a caminar",
        "solution_lead": [
            "Definimos el uso —video, efectos o ambos—, la medida de la pista y si queda fija o se "
            "arma por evento. Con eso elegimos modelo, pitch y terminación.",
        ],
        "series_labels": {},
        "note": "El PDANCE reproduce video con acabado de vidrio templado de 10 mm. El P-60 DISCO y el "
                "PI-RGB trabajan con efectos de luz integrados, para pistas donde no se busca imagen "
                "sino ambiente.",
        "steps": [
            ("Definición de la pista", "Medida, uso previsto y si queda fija o se arma por evento."),
            ("Fabricación e instalación", "Armado de los paneles, nivelación, terminación de bordes y puesta en marcha."),
            ("Repuestos y servicio técnico", "Paneles, fuentes y placas disponibles después de la instalación."),
        ],
        "cta_title": "Cotizar un piso LED",
        "cta_lead": "Indicanos la medida de la pista, si queda fija o se arma por evento y qué querés "
                    "mostrar. Devolvemos una propuesta con modelo, medida final y valor.",
    },
    {
        "slug": "porticos",
        "cat": "porticos",
        "nav": "Pórticos",
        "meta_title": "Pórticos LED de señalización vial para rutas y avenidas | RTM",
        "meta_desc": "Pórticos LED de mensajería variable para rutas, autopistas y avenidas. "
                     "Fabricación a medida del pescante, instalación y servicio técnico en Argentina.",
        "h1": "Pórticos LED de señalización vial",
        "h1_span": "para rutas, autopistas y avenidas",
        "lead": "Mensajería variable que tiene que leerse a velocidad de ruta. Fabricamos el equipo "
                "para el pescante donde va, lo instalamos y damos servicio.",
        "hero_image": None,
        "proof": [
            "Tres formatos: LPR-9648, LPR-1248 y LPR-1264",
            "4500 a 5500 nits para lectura a pleno sol",
            "Instalación sobre pescante a cargo nuestro",
        ],
        "wa_hero": "Hola, quiero consultar por un pórtico LED.\n\nDónde va: \nAncho disponible: \nVelocidad de paso: ",
        "wa_final": "Hola, quiero consultar por un pórtico LED.\n\nDónde va: \nAncho disponible: \nVelocidad de paso: ",
        "wa_dock": "Hola, estoy viendo los pórticos LED y quiero asesoramiento para mi proyecto vial.",
        "problem_title": "Un cartel de ruta se lee en dos segundos, o no se lee",
        "problem_lead": "Un pórtico no se mira: se cruza a ochenta o a cien por hora. El pitch, el brillo "
                        "y el contraste no se eligen por catálogo, se eligen por la velocidad de paso y "
                        "la distancia desde la que se empieza a leer.",
        "problems": [
            ("Pitch elegido sin distancia.", "Fino de más es plata que nadie ve; grueso de más deja el mensaje ilegible."),
            ("Brillo que no le gana al sol.", "Por debajo de 4500 nits, al mediodía la ruta no lee nada."),
            ("Medida forzada al pescante.", "Adaptar un panel estándar deja huecos o sobra estructura."),
        ],
        "closing": "Un pórtico se instala una vez y queda a la intemperie durante años. Lo que se define "
                   "mal en el relevamiento se paga en cada cambio de mensaje y en cada visita de service.",
        "solution_title": "El equipo se define en el pescante, no en el catálogo",
        "solution_lead": [
            "Relevamos el pescante —ancho y alto, distancia y velocidad de lectura, alimentación— y "
            "con eso definimos medida, pitch y brillo.",
        ],
        "series_labels": {},
        "note": None,
        "steps": [
            ("Relevamiento del pescante", "Ancho disponible, distancia y velocidad de lectura, alimentación eléctrica."),
            ("Fabricación e instalación", "Armado para ese punto, montaje sobre la estructura y puesta en marcha."),
            ("Repuestos y servicio técnico", "Módulos, fuentes y placas disponibles después de la instalación."),
        ],
        "cta_title": "Consultar por un pórtico",
        "cta_lead": "Contanos dónde va, el ancho disponible en el pescante y a qué velocidad se cruza. "
                    "Devolvemos una propuesta con medida, pitch y valor.",
    },
    {
        "slug": "soluciones",
        "cat": "soluciones",
        "nav": "Soluciones",
        "meta_title": "Carteleras LED para colectivos y pantallas de diseño especial | RTM",
        "meta_desc": "Carteleras y lunetas LED para transporte público, con control por red 4G y GPS, y "
                     "pantallas de diseño especial fabricadas a medida.",
        "h1": "Soluciones LED a medida",
        "h1_span": "transporte y proyectos especiales",
        "lead": "Cuando el equipo de catálogo no entra, lo fabricamos: carteleras y lunetas para "
                "colectivos, y pantallas de diseño especial para proyectos sin medida estándar.",
        "hero_image": "/proyectos_imagenes/proyecto_13.webp",
        "proof": [
            "Carteleras y lunetas para transporte público",
            "Control de contenido por red 4G y GPS",
            "Diseños especiales fabricados a medida",
        ],
        "wa_hero": "Hola, quiero consultar por una solución LED a medida.\n\nDónde se monta: \nQué tiene que mostrar: \nMedida aproximada: ",
        "wa_final": "Hola, quiero consultar por una solución LED a medida.\n\nDónde se monta: \nQué tiene que mostrar: \nMedida aproximada: ",
        "wa_dock": "Hola, estoy viendo las soluciones LED a medida y quiero asesoramiento para mi proyecto.",
        "problem_title": "Cuando el proyecto no entra en un producto de catálogo",
        "problem_lead": "Una cartelera de colectivo y una pantalla de doble cara a medida no comparten "
                        "casi nada, salvo esto: las dos se definen por dónde se montan y qué tienen que "
                        "resistir, no por una lista de precios.",
        "problems": [
            ("Medida que no existe en catálogo.", "Forzar un panel estándar deja huecos o sobra estructura."),
            ("Montaje sobre vehículo.", "Vibración, peso y alimentación de la unidad condicionan todo el diseño."),
            ("Contenido que se actualiza a mano.", "Sin control remoto, cada cambio obliga a subir a cada unidad de la flota."),
        ],
        "closing": "En estos proyectos el equipo se define antes de fabricarse. Por eso el relevamiento no "
                   "es un trámite: es la parte que decide si la solución va a funcionar.",
        "solution_title": "Fabricación a medida con relevamiento previo",
        "solution_lead": [
            "Relevamos el punto de montaje, definimos medida, pitch, brillo y cómo se actualiza el "
            "contenido, y fabricamos el equipo para ese caso.",
        ],
        "series_labels": {},
        "note": "Las lunetas LED para colectivos admiten control por red 4G y GPS, para cambiar el mensaje "
                "sin subir a la unidad. Si tu proyecto es señalización vial sobre pescante, está en "
                "Pórticos.",
        "steps": [
            ("Relevamiento del punto de montaje", "Unidad o estructura: medidas, alimentación y condiciones de lectura."),
            ("Fabricación e instalación", "Armado para ese proyecto, montaje y prueba en el lugar definitivo."),
            ("Repuestos y servicio técnico", "Módulos, fuentes y placas disponibles después de la instalación."),
        ],
        "cta_title": "Consultar por un proyecto a medida",
        "cta_lead": "Contanos dónde se monta, qué tiene que mostrar y desde qué distancia se lee. "
                    "Devolvemos una propuesta con medida, pitch y valor.",
    },
    {
        "slug": "led-trucks",
        "cat": "led-trucks",
        "nav": "LED Trucks",
        "offer_eyebrow": "El trabajo",
        "meta_title": "LED Trucks: camiones con pantalla LED para publicidad móvil | RTM",
        "meta_desc": "Camiones equipados con pantallas LED para campañas, eventos y activaciones. RTM "
                     "realiza el diseño, la fabricación, la instalación y la puesta en marcha.",
        "h1": "LED Trucks",
        "h1_span": "publicidad móvil sobre camión",
        "lead": "Camiones equipados con pantalla LED para campañas, recorridos urbanos y activaciones de "
                "marca. Hacemos el diseño, la fabricación, la instalación y la puesta en marcha.",
        "hero_image": "/proyectos_imagenes/proyecto_1.webp",
        # LED Trucks no tiene fichas por modelo en el catálogo: la vista ?cat= repite la galería
        # que ya está más abajo, así que el hero se queda con una sola acción.
        "hero_secondary": False,
        "proof": [
            "Diseño, fabricación e instalación propios",
            "Sonido profesional integrado",
            "Pantallas de alta resolución para exterior",
        ],
        "wa_hero": "Hola, quiero consultar por un LED Truck.\n\nTengo unidad propia: \nTipo de campaña: \nZona de recorrido: ",
        "wa_final": "Hola, quiero consultar por un LED Truck.\n\nTengo unidad propia: \nTipo de campaña: \nZona de recorrido: ",
        "wa_dock": "Hola, estoy viendo los LED Trucks y quiero asesoramiento para mi campaña.",
        "problem_title": "Un camión con pantalla no es una pantalla arriba de un camión",
        "problem_lead": "El formato móvil suma variables que una instalación fija no tiene: el equipo "
                        "viaja, vibra, se alimenta del vehículo y trabaja a la intemperie todo el día.",
        "problems": [
            ("Estructura improvisada.", "Paneles sobre una caja no calculada terminan en juntas abiertas y fallas por vibración."),
            ("Brillo de interior en la calle.", "A pleno sol el recorrido se hace igual y no comunica nada."),
            ("Responsabilidad repartida.", "Carrocero, proveedor de pantalla e instalador eléctrico, sin un responsable único."),
        ],
        "closing": "El LED Truck se contrata para que salga a la calle todos los días de la campaña. Todo "
                   "lo demás es secundario.",
        "solution_title": "Diseño, fabricación e instalación del conjunto",
        "solution_lead": [
            "Trabajamos sobre el vehículo completo: estructura, pantalla, alimentación y sonido. "
            "Entregamos el camión funcionando.",
        ],
        "series_labels": {},
        "note": None,
        "steps": [
            ("Relevamiento del vehículo", "Medidas de la unidad, estructura disponible y consumo eléctrico."),
            ("Fabricación e instalación", "Pantalla, estructura, alimentación y sonido, montados y probados en calle."),
            ("Repuestos y servicio técnico", "Módulos, fuentes y placas disponibles durante la operación."),
        ],
        "cta_title": "Consultar por un LED Truck",
        "cta_lead": "Contanos si ya tenés la unidad o hay que definirla, el tipo de campaña y la zona de "
                    "recorrido. Devolvemos una propuesta con medida de pantalla, equipamiento y valor.",
    },
    {
        "slug": "iluminacion-profesional",
        "cat": "iluminacion-profesional",
        "nav": "Iluminación Profesional",
        "meta_title": "Iluminación profesional para escenarios y eventos | RTM",
        "meta_desc": "Cabezales móviles beam y 3 en 1, barras móviles y flashes LED para shows, salones y "
                     "producciones. Venta con repuestos y servicio técnico en Argentina.",
        "h1": "Iluminación profesional",
        "h1_span": "para escenarios, salones y producciones",
        "lead": "Cabezales móviles, barras y flashes para show en vivo, con repuestos y servicio técnico "
                "local. El mismo respaldo que damos en pantallas.",
        "hero_image": None,
        "proof": [
            "Cabezales beam 7R y 20R",
            "Cabezales 3 en 1: beam, spot y wash",
            "Repuestos y servicio técnico en Argentina",
        ],
        "wa_hero": "Hola, quiero cotizar equipos de iluminación.\n\nTipo de espacio: \nAltura de montaje: \nEquipos que ya tengo: ",
        "wa_final": "Hola, quiero cotizar equipos de iluminación.\n\nTipo de espacio: \nAltura de montaje: \nEquipos que ya tengo: ",
        "wa_dock": "Hola, estoy viendo los equipos de iluminación y quiero asesoramiento para armar el rig.",
        "problem_title": "Equipos de show comprados sin respaldo posterior",
        "problem_lead": "En iluminación de espectáculo el problema no suele ser la compra: es lo que pasa "
                        "seis meses después, cuando hay que reemplazar una lámpara o reparar un cabezal "
                        "antes de una fecha.",
        "problems": [
            ("Sin repuestos disponibles.", "Una lámpara o una placa que hay que importar deja el equipo parado semanas."),
            ("Sin servicio técnico local.", "Un cabezal sin quien lo repare se transforma en equipo de descarte."),
            ("Potencia mal elegida.", "Un beam corto no llega en un escenario grande; uno de más encandila en un salón."),
        ],
        "closing": "Un equipo de iluminación se amortiza en fechas. Lo que define si conviene no es el "
                   "precio inicial, sino cuántas noches puede salir a trabajar.",
        "solution_title": "Equipos elegidos por el tipo de espacio y de show",
        "solution_lead": [
            "Definimos el espacio —altura, distancia, tipo de producción— y con eso armamos el rig: "
            "beam para largo alcance, 3 en 1 para cubrir todo con una unidad, barras y flashes.",
        ],
        "series_labels": {},
        "note": None,
        "steps": [
            ("Definición del rig", "Espacio, altura de montaje, tipo de show y equipos que ya tenés."),
            ("Selección y entrega", "Cantidad, potencia y tipo de cabezal, verificados antes de entregar."),
            ("Repuestos y servicio técnico", "Lámparas, placas y repuestos disponibles; reparación local."),
        ],
        "cta_title": "Cotizar equipos de iluminación",
        "cta_lead": "Contanos el tipo de espacio, la altura de montaje y qué equipos ya tenés. Devolvemos "
                    "una propuesta con modelos, cantidades y valor.",
    },
]

NAV = [
    ("/index.html", "Home"),
    ("/index.html#about", "Nosotros"),
    ("/productos.html", "Productos"),
    ("/guia.html#guia-productos", "Guía"),
    ("/index.html#clientes", "Clientes"),
    ("/proyectos.html", "Proyectos"),
]


def model_cards(cfg):
    """Fichas de modelo tomadas de data/products.json: nada de specs escritas a mano."""
    cat = CATS_BY_SLUG[cfg["cat"]]
    order = SPEC_ORDER.get(cfg["cat"], [])
    labels = cfg.get("series_labels") or {}
    out = []
    for sub in cat.get("subcategories") or []:
        for m in sub.get("models") or []:
            serie = labels.get(m["name"])
            if serie is None and sub["slug"] != "modelos":
                serie = sub["name"]

            specs = []
            if m.get("pixelPitch"):
                specs.append(("Pitch", m["pixelPitch"]))
            for key in order:
                if len(specs) >= 3:
                    break
                if m.get("specs", {}).get(key):
                    specs.append((SPEC_LABELS.get(key, key), m["specs"][key]))

            img = m.get("image")
            media = ""
            if img:
                media = (
                    '        <div class="lp-model__media">\n'
                    f'          <img src="/{ea(img.lstrip("/"))}" alt="{ea(m["name"])} — {ea(cat["name"])}" '
                    'loading="lazy" decoding="async">\n'
                    "        </div>\n"
                )

            spec_rows = ""
            if specs:
                rows = "".join(
                    f"            <dt>{e(k)}</dt><dd>{e(v)}</dd>\n" for k, v in specs
                )
                spec_rows = f'          <dl class="lp-model__specs">\n{rows}          </dl>\n'

            url = f'/productos.html?cat={cat["slug"]}&amp;sub={sub["slug"]}&amp;model={m["slug"]}'
            serie_html = (
                f'<span class="lp-model__serie">{e(serie)}</span>' if serie else ""
            )
            out.append(
                "      <li class=\"lp-model\">\n"
                f"{media}"
                '        <div class="lp-model__body">\n'
                f'          <h3 class="lp-model__name">{serie_html}{e(m["name"])}</h3>\n'
                f'          <p class="lp-model__text">{e(m.get("description", ""))}</p>\n'
                f"{spec_rows}"
                f'          <a class="lp-model__link" href="{url}">Ver ficha técnica</a>\n'
                "        </div>\n"
                "      </li>"
            )
    return out


def gallery_items(cfg):
    cat = CATS_BY_SLUG[cfg["cat"]]
    items = (cat.get("content") or {}).get("gallery") or []
    out = []
    for it in items:
        out.append(
            "      <li>\n"
            "        <figure>\n"
            f'          <img src="/{ea(it["image"].lstrip("/"))}" alt="{ea(it["caption"])}" '
            'loading="lazy" decoding="async">\n'
            f'          <figcaption>{e(it["caption"])}</figcaption>\n'
            "        </figure>\n"
            "      </li>"
        )
    return out


def nav_html(active_href, indent):
    pad = " " * indent
    out = []
    for href, label in NAV:
        cls = ' class="active"' if href == active_href else ""
        out.append(f'{pad}<li><a href="{href}"{cls}>{e(label)}</a></li>')
    return "\n".join(out)


def build(cfg):
    slug = cfg["slug"]
    cat = CATS_BY_SLUG[cfg["cat"]]
    url = f"https://pantallasledrtm.com/productos/{slug}.html"
    og_image = (
        f'https://pantallasledrtm.com{cfg["hero_image"]}'
        if cfg.get("hero_image")
        else "https://pantallasledrtm.com/rtm_logo/rtmLogo.png"
    )

    hero_style = (
        f' style="--lp-hero-image: url(\'{cfg["hero_image"]}\')"'
        if cfg.get("hero_image")
        else ""
    )
    hero_preload = (
        f'  <link rel="preload" as="image" href="{cfg["hero_image"]}" fetchpriority="high">\n'
        if cfg.get("hero_image")
        else ""
    )

    proof = "\n".join(f"          <li>{e(p)}</li>" for p in cfg["proof"])
    problems = "\n".join(
        f"        <li><strong>{e(t)}</strong><span>{e(d)}</span></li>"
        for t, d in cfg["problems"][:3]
    )
    solution_leads = "\n".join(
        f'        <p class="lp-lead">{e(p)}</p>' for p in cfg["solution_lead"][:1]
    )
    steps = "\n".join(
        f"        <li><strong>{e(t)}</strong><span>{e(d)}</span></li>"
        for t, d in cfg["steps"][:3]
    )

    cards = model_cards(cfg)
    if cards:
        offer_block = (
            '      <ul class="lp-models">\n' + "\n".join(cards) + "\n      </ul>"
        )
    else:
        offer_block = (
            '      <ul class="lp-gallery">\n' + "\n".join(gallery_items(cfg)) + "\n      </ul>"
        )

    note = (
        f'\n      <p class="lp-note">{e(cfg["note"])}</p>' if cfg.get("note") else ""
    )

    hero_secondary = ""
    if cfg.get("hero_secondary", True):
        hero_secondary = (
            f'          <a class="btn btn--secondary" href="/productos.html?cat={cat["slug"]}"\n'
            '             data-conversion="content_cta_click" data-conversion-placement="landing_hero_catalogo"\n'
            f'             data-context="{slug}">\n'
            "            Ver modelos y fichas técnicas\n"
            "          </a>\n"
        )

    related = "\n".join(
        f'          <li><a href="/productos/{o["slug"]}.html">{e(o["nav"])}</a></li>'
        for o in CATEGORIES
        if o["slug"] != slug
    )

    footer_products = "\n".join(
        f'          <li><a href="/productos/{o["slug"]}.html">{e(o["nav"])}</a></li>'
        for o in CATEGORIES
    )

    breadcrumb_ld = json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Inicio",
                 "item": "https://pantallasledrtm.com/"},
                {"@type": "ListItem", "position": 2, "name": "Productos",
                 "item": "https://pantallasledrtm.com/productos.html"},
                {"@type": "ListItem", "position": 3, "name": cat["name"], "item": url},
            ],
        },
        ensure_ascii=False,
        indent=2,
    )

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(cfg["meta_title"])}</title>

  <meta name="description" content="{ea(cfg["meta_desc"])}">
  <link rel="canonical" href="{url}">

  <!-- Open Graph -->
  <meta property="og:type"        content="website">
  <meta property="og:url"         content="{url}">
  <meta property="og:title"       content="{ea(cfg["meta_title"])}">
  <meta property="og:description" content="{ea(cfg["meta_desc"])}">
  <meta property="og:image"       content="{og_image}">

  <!-- Favicons -->
  <link rel="icon"             href="/favicon.ico" type="image/x-icon" sizes="any">
  <link rel="shortcut icon"    href="/favicon.ico" type="image/x-icon">
  <link rel="icon"             type="image/png" sizes="48x48" href="/rtm_logo/favicon-48x48.png">
  <link rel="icon"             type="image/png" sizes="32x32" href="/rtm_logo/favicon-32x32.png">
  <link rel="icon"             type="image/png" sizes="16x16" href="/rtm_logo/favicon-16x16.png">
  <link rel="apple-touch-icon" sizes="180x180"               href="/rtm_logo/apple-touch-icon.png">

  <!-- Schema.org -->
  <script type="application/ld+json">
{breadcrumb_ld}
  </script>

  <!-- Preconnect -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
{hero_preload}
  <!-- Tipografía e Iconos -->
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&amp;display=swap" rel="stylesheet" media="print" onload="this.media='all'">
  <noscript><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&amp;display=swap" rel="stylesheet"></noscript>
  <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet" media="print" onload="this.media='all'">
  <noscript><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet"></noscript>

  <!-- CSS -->
  <link rel="stylesheet" href="/css/main.css?v={MAIN_CSS_V}">
  <link rel="stylesheet" href="/css/landing.css?v={CSS_V}">

  <!--
    Microsoft Clarity, sólo en producción.
    El guard no es higiene: el 2026-08-12, 42 de 119 sesiones del día vinieron de 127.0.0.1:5500 y
    localhost:8000 — 35 % de desarrollo propio mezclado con visitantes reales. Eso movía todos los
    agregados y no se puede separar después, porque Clarity sólo conserva los últimos días.
  -->
  <script type="text/javascript">
    if (/(^|\\.)pantallasledrtm\\.com$/i.test(location.hostname)) {{
      (function(c,l,a,r,i,t,y){{
          c[a]=c[a]||function(){{(c[a].q=c[a].q||[]).push(arguments)}};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      }})(window, document, "clarity", "script", "xvo6v2qw7h");
    }}
  </script>

  <!-- Google Analytics y Ads, sólo en producción para no contaminar las mediciones con QA local. -->
  <script type="text/javascript">
    if (/(^|\\.)pantallasledrtm\\.com$/i.test(location.hostname)) {{
      const googleTag = document.createElement('script');
      googleTag.async = true;
      googleTag.src = 'https://www.googletagmanager.com/gtag/js?id=AW-18364923277';
      document.head.appendChild(googleTag);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function(){{ window.dataLayer.push(arguments); }};
      window.gtag('js', new Date());
      window.gtag('config', 'AW-18364923277');
      window.gtag('config', 'G-6BP4Y1KSSK');
    }}
  </script>
</head>
<body>

  <a href="#contenido" class="skip-link">Saltar al contenido</a>

  <!-- ================== HEADER ================== -->
  <header class="site-header" role="banner">
    <nav class="navbar" aria-label="Principal">
      <button class="btn-back" onclick="history.back()" aria-label="Volver atrás">
        <i class="fas fa-arrow-left"></i>
      </button>

      <a class="brand" href="/index.html" aria-label="RTM Pantallas LED - Inicio">
        <img src="/rtm_logo/rtmLogo.png" alt="RTM Pantallas LED - Logo" width="300" height="60">
      </a>

      <div class="nav-center">
        <ul class="menu">
{nav_html('/productos.html', 10)}
        </ul>
      </div>

      <div class="cta-wrapper">
        <a class="btn btn--header-whatsapp"
           href="{wa(cfg['wa_dock'])}"
           target="_blank" rel="noopener noreferrer"
           data-conversion="whatsapp_click" data-conversion-placement="landing_header"
           data-context="{slug}">
          Cotizar
        </a>
      </div>

      <input type="checkbox" id="nav-toggle" aria-label="Abrir o cerrar menú" aria-controls="mobile-menu" aria-expanded="false">
      <label for="nav-toggle" class="burger-wrap">
        <div class="burger"><span></span></div>
      </label>

      <div class="drawer" id="mobile-menu" aria-label="Menú móvil">
        <ul>
{nav_html('/productos.html', 10)}
          <li><a href="/index.html#contacto">Contacto</a></li>
        </ul>
      </div>
    </nav>
  </header>

  <main id="contenido">

    <!-- ================== HERO ================== -->
    <section class="lp-hero"{hero_style}>
      <div class="lp-hero__wrap">
        <nav class="lp-breadcrumb" aria-label="Migas de pan">
          <a href="/index.html">Inicio</a>
          <span class="separator" aria-hidden="true">/</span>
          <a href="/productos.html">Productos</a>
          <span class="separator" aria-hidden="true">/</span>
          <span aria-current="page">{e(cat["name"])}</span>
        </nav>

        <h1 class="lp-hero__title">{e(cfg["h1"])} <span>{e(cfg["h1_span"])}</span></h1>
        <p class="lp-hero__lead">{e(cfg["lead"])}</p>

        <div class="lp-hero__actions">
          <a class="btn btn--primary"
             href="{wa(cfg['wa_hero'])}"
             target="_blank" rel="noopener noreferrer"
             data-conversion="whatsapp_click" data-conversion-placement="landing_hero"
             data-context="{slug}">
            Pedir cotización por WhatsApp
          </a>
{hero_secondary}        </div>

        <ul class="lp-hero__proof">
{proof}
        </ul>
      </div>
    </section>

    <!-- ================== MODELOS ================== -->
    <!--
      Los modelos van antes que el argumento a propósito. Medido a 390 px, el visitante promedio
      llega a ~3.100 px (34 % de scroll): con el problema arriba, el producto quedaba justo en el
      borde de esa ventana y el CTA de cierre al 81 % de la página, o sea fuera del alcance de
      cualquiera. Quien llega desde un anuncio de producto viene a ver el producto.
    -->
    <section class="lp-section" aria-labelledby="modelos-title">
      <div class="lp-section__wrap">
        <p class="lp-eyebrow">{e(cfg.get("offer_eyebrow", "Modelos"))}</p>
        <h2 class="lp-title" id="modelos-title">{e(cfg["solution_title"])}</h2>
{solution_leads}

{offer_block}{note}

        <div class="lp-inline-cta">
          <a class="btn btn--primary"
             href="{wa(cfg['wa_final'])}"
             target="_blank" rel="noopener noreferrer"
             data-conversion="whatsapp_click" data-conversion-placement="landing_modelos"
             data-context="{slug}">
            {e(cfg["cta_title"])}
          </a>
          <span>Respondemos con serie, medida y valor.</span>
        </div>
      </div>
    </section>

    <!-- ================== QUÉ INCLUYE ================== -->
    <section class="lp-section lp-section--light" aria-labelledby="proceso-title">
      <div class="lp-section__wrap">
        <p class="lp-eyebrow">Alcance</p>
        <h2 class="lp-title" id="proceso-title">Qué incluye el trabajo</h2>

        <ol class="lp-steps">
{steps}
        </ol>
      </div>
    </section>

    <!-- ================== PROBLEMA ================== -->
    <section class="lp-section" aria-labelledby="problema-title">
      <div class="lp-section__wrap">
        <p class="lp-eyebrow">El problema</p>
        <h2 class="lp-title" id="problema-title">{e(cfg["problem_title"])}</h2>

        <ul class="lp-problems">
{problems}
        </ul>
      </div>
    </section>

    <!-- ================== CIERRE ================== -->
    <section class="lp-cta" id="cotizar" aria-labelledby="cta-title">
      <div class="lp-cta__wrap">
        <div class="lp-cta__text">
          <h2 class="lp-cta__title" id="cta-title">{e(cfg["cta_title"])}</h2>
          <p class="lp-cta__lead">{e(cfg["cta_lead"])}</p>
        </div>
        <div class="lp-cta__actions">
          <a class="btn btn--primary"
             href="{wa(cfg['wa_final'])}"
             target="_blank" rel="noopener noreferrer"
             data-conversion="whatsapp_click" data-conversion-placement="landing_final"
             data-context="{slug}">
            Consultar por WhatsApp
          </a>
          <a class="btn btn--secondary" href="/proyectos.html"
             data-conversion="content_cta_click" data-conversion-placement="landing_final_proyectos"
             data-context="{slug}">
            Ver proyectos instalados
          </a>
        </div>
      </div>
    </section>

    <!-- ================== OTRAS CATEGORÍAS ================== -->
    <nav class="lp-related" aria-labelledby="otras-title">
      <div class="lp-related__wrap">
        <h2 id="otras-title">Otras categorías</h2>
        <ul>
{related}
        </ul>
      </div>
    </nav>

  </main>

  <!-- ================== FOOTER ================== -->
  <footer role="contentinfo">
    <div class="footer-content">
      <div class="footer-brand">
        <img src="/rtm_logo/rtmLogo.png" alt="RTM Pantallas LED" loading="lazy">
        <p>Especialistas en desarrollo, fabricación e instalación de pantallas LED profesionales.</p>
      </div>
      <div class="footer-links">
        <h4>Productos</h4>
        <ul>
{footer_products}
        </ul>
      </div>
      <div class="footer-links">
        <h4>Empresa</h4>
        <ul>
          <li><a href="/index.html#about">Nosotros</a></li>
          <li><a href="/index.html#clientes">Clientes</a></li>
          <li><a href="/proyectos.html">Proyectos</a></li>
          <li><a href="/guia.html#guia-productos">Guía</a></li>
        </ul>
      </div>
      <div class="footer-links">
        <h4>Contacto</h4>
        <ul>
          <li><a href="tel:+5491151531530" data-conversion="phone_footer" data-context="{slug}"><i class="fas fa-phone"></i> +54 9 11 5153 1530</a></li>
          <li><a href="mailto:info@pantallasledrtm.com" data-conversion="email_footer" data-context="{slug}"><i class="fas fa-envelope"></i> info@pantallasledrtm.com</a></li>
          <li><a href="{wa(cfg['wa_dock'])}" target="_blank" rel="noopener noreferrer" data-conversion="whatsapp_click" data-conversion-placement="landing_footer" data-context="{slug}"><i class="fab fa-whatsapp"></i> WhatsApp</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© 2026 RTM Pantallas LED. Todos los derechos reservados.</p>
    </div>
  </footer>

  <!--
    Dock persistente. Lleva el id `catalog-whatsapp-cta` a propósito: con ese id `main.js`
    (initPersistentConversionDock) respeta el enlace y el texto que están acá en lugar de
    reescribirlos con el mensaje genérico del sitio, y así el chat arranca con el contexto de
    la categoría. Por el mismo motivo main.js no engancha su IntersectionObserver, así que esta
    página oculta el dock cuando cualquiera de sus acciones principales está a la vista.
  -->
  <div class="floating-buttons" aria-label="Accesos rápidos">
    <a id="catalog-whatsapp-cta"
       class="floating-btn floating-btn--whatsapp floating-btn--expanded"
       href="{wa(cfg['wa_dock'])}"
       target="_blank" rel="noopener noreferrer"
       aria-label="Consultar por WhatsApp sobre {ea(cat['name'])}"
       data-conversion="whatsapp_click"
       data-conversion-placement="landing_persistent"
       data-context="{slug}">
      <i class="fab fa-whatsapp" aria-hidden="true"></i>
      <span class="floating-btn__copy">
        <span class="floating-btn__label">Cotizar por WhatsApp</span>
      </span>
    </a>
  </div>

  <script src="/js/conversion-tracking.js?v={TRACK_V}" defer></script>
  <script src="/js/main.js?v={MAIN_JS_V}" defer></script>
  <script>
    // El dock se esconde cerca de cualquier CTA principal: dos veces la misma acción en pantalla no
    // agrega una decisión (AGENTS.md §3).
    (() => {{
      const dock = document.querySelector('.floating-buttons');
      const targets = document.querySelectorAll('.lp-hero__actions, .lp-inline-cta, .lp-cta');
      if (!dock || targets.length === 0 || !('IntersectionObserver' in window)) return;

      const visibleTargets = new Set();
      const observer = new IntersectionObserver(entries => {{
        entries.forEach(entry => {{
          if (entry.isIntersecting) visibleTargets.add(entry.target);
          else visibleTargets.delete(entry.target);
        }});
        dock.hidden = visibleTargets.size > 0;
      }}, {{ threshold: 0.15 }});

      targets.forEach(target => observer.observe(target));
    }})();
  </script>

</body>
</html>
"""


def main():
    os.makedirs(OUT, exist_ok=True)
    for cfg in CATEGORIES:
        path = os.path.join(OUT, f"{cfg['slug']}.html")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(build(cfg))
        print("escrito", path)


if __name__ == "__main__":
    main()
