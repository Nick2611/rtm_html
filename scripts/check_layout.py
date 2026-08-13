#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Mide en el DOM real cada ficha de producto de las landings y detecta recortes o deformaciones.

Inyecta un script de medición en una copia de cada landing, la renderiza en Chrome headless y
vuelca el DOM ya mutado. No hay inspección visual: compara la caja de la imagen contra el content
box de su contenedor y la relación de aspecto renderizada contra la natural.
"""

import json
import os
import re
import subprocess
import sys
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRATCH = os.path.join(ROOT, ".check-tmp")
STAGE = os.path.join(SCRATCH, "stage")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 8901

PROBE = """
<div id="rtm-report" hidden></div>
<script>
(async () => {
  // Las fichas usan loading="lazy": bajo el fold no se descargan y naturalWidth queda en 0.
  // Forzamos la carga y la esperamos antes de medir.
  const imgs = [...document.querySelectorAll('.lp-model__media img')];
  imgs.forEach(im => { im.loading = 'eager'; if (!im.complete) im.src = im.src; });
  await Promise.all(imgs.map(im => im.complete && im.naturalWidth
    ? Promise.resolve()
    : new Promise(res => { im.addEventListener('load', res, {once:true});
                           im.addEventListener('error', res, {once:true}); })));

  const out = [];
  document.querySelectorAll('.lp-model').forEach(card => {
    const box = card.querySelector('.lp-model__media');
    const nameEl = card.querySelector('.lp-model__name');
    const serie = nameEl?.querySelector('.lp-model__serie');
    const name = ((nameEl?.textContent || '').replace(serie?.textContent || '', '')).trim();
    if (!box) { out.push({name, media: false}); return; }
    const img = box.querySelector('img');
    if (!img) { out.push({name, media: true, img: false}); return; }

    const b  = box.getBoundingClientRect();
    const i  = img.getBoundingClientRect();
    const cs = getComputedStyle(box);
    const pt = parseFloat(cs.paddingTop),   pb = parseFloat(cs.paddingBottom);
    const pl = parseFloat(cs.paddingLeft),  pr = parseFloat(cs.paddingRight);
    const bt = parseFloat(cs.borderTopWidth), bb = parseFloat(cs.borderBottomWidth);

    // content box del contenedor
    const cTop = b.top + bt + pt, cBottom = b.bottom - bb - pb;
    const cLeft = b.left + pl,    cRight  = b.right - pr;

    out.push({
      name,
      media: true, img: true,
      loaded: img.complete && img.naturalWidth > 0,
      natW: img.naturalWidth, natH: img.naturalHeight,
      boxW: +(cRight - cLeft).toFixed(2), boxH: +(cBottom - cTop).toFixed(2),
      imgW: +i.width.toFixed(2), imgH: +i.height.toFixed(2),
      overTop:    +Math.max(0, cTop - i.top).toFixed(2),
      overBottom: +Math.max(0, i.bottom - cBottom).toFixed(2),
      overLeft:   +Math.max(0, cLeft - i.left).toFixed(2),
      overRight:  +Math.max(0, i.right - cRight).toFixed(2),
      src: (img.getAttribute('src') || '')
    });
  });
  document.getElementById('rtm-report').textContent = JSON.stringify(out);
})();
</script>
"""


def stage_pages():
    """Copia el sitio a un staging y le inyecta la sonda a cada landing."""
    subprocess.run(["rm", "-rf", STAGE], check=True)
    os.makedirs(STAGE, exist_ok=True)
    for entry in ("css", "js", "data", "productos", "rtm_logo", "imagenes_productos",
                  "imagenes_productos_restantes", "proyectos_imagenes", "favicon.ico"):
        src = os.path.join(ROOT, entry)
        if os.path.exists(src):
            subprocess.run(["cp", "-R", src, STAGE], check=True)

    for path in glob.glob(os.path.join(STAGE, "productos", "*.html")):
        html = open(path, encoding="utf-8").read()
        html = html.replace("</body>", PROBE + "\n</body>")
        open(path, "w", encoding="utf-8").write(html)


def measure(slug, width, height=2400):
    url = f"http://localhost:{PORT}/productos/{slug}.html"
    res = subprocess.run(
        [CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
         f"--window-size={width},{height}", "--virtual-time-budget=8000",
         "--dump-dom", url],
        capture_output=True, text=True, timeout=90,
    )
    m = re.search(r'<div id="rtm-report" hidden="">(.*?)</div>', res.stdout, re.S)
    if not m:
        m = re.search(r'<div id="rtm-report" hidden>(.*?)</div>', res.stdout, re.S)
    if not m:
        return None
    raw = m.group(1)
    for a, b in (("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"')):
        raw = raw.replace(a, b)
    return json.loads(raw)


def main():
    stage_pages()
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT)],
        cwd=STAGE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    import time
    time.sleep(1.2)

    slugs = [os.path.basename(p)[:-5] for p in sorted(glob.glob(os.path.join(ROOT, "productos", "*.html")))]
    widths = [(1440, "desktop"), (900, "tablet"), (390, "angosto")]

    problems = []
    checked = 0
    try:
        for width, label in widths:
            for slug in slugs:
                rows = measure(slug, width)
                if rows is None:
                    problems.append((label, slug, "—", "no se pudo leer el reporte"))
                    continue
                for r in rows:
                    checked += 1
                    name = r.get("name") or "?"
                    if not r.get("media"):
                        continue  # tarjetas sin imagen (galería), no aplica
                    if not r.get("img"):
                        problems.append((label, slug, name, "sin <img> en la caja"))
                        continue
                    if not r.get("loaded"):
                        problems.append((label, slug, name, f"imagen no cargó: {r.get('src')}"))
                        continue

                    over = max(r["overTop"], r["overBottom"], r["overLeft"], r["overRight"])
                    if over > 0.5:
                        problems.append((label, slug, name,
                                         f"RECORTE {over:.1f}px "
                                         f"(arriba {r['overTop']}, abajo {r['overBottom']}, "
                                         f"izq {r['overLeft']}, der {r['overRight']})"))

                    if r["imgH"] > 0 and r["natH"] > 0:
                        ar_render = r["imgW"] / r["imgH"]
                        ar_nat = r["natW"] / r["natH"]
                        # con object-fit: contain la caja pintada puede ser mayor que el contenido;
                        # comparamos el contenido efectivo
                        fit = min(r["boxW"] / r["natW"], r["boxH"] / r["natH"])
                        cw, ch = r["natW"] * fit, r["natH"] * fit
                        if cw - r["boxW"] > 0.5 or ch - r["boxH"] > 0.5:
                            problems.append((label, slug, name, "el contenido no entra en la caja"))
    finally:
        server.terminate()

    print(f"mediciones: {checked} fichas ({len(slugs)} landings x {len(widths)} anchos)\n")
    if not problems:
        print("SIN RECORTES NI DEFORMACIONES")
    else:
        print(f"{len(problems)} PROBLEMAS:")
        for label, slug, name, msg in problems:
            print(f"  [{label:8}] {slug:26} {name:16} {msg}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
