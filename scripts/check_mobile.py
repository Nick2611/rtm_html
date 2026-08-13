#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Validación mobile de las landings: detecta desborde horizontal y qué elemento lo causa.

No se apoya en capturas. Mide en el DOM el ancho de scroll contra el viewport y, si hay desborde,
identifica el elemento culpable. Usa un user agent móvil para que Chrome honre
`<meta name="viewport" content="width=device-width">`; el script verifica que la emulación haya
tomado efecto comparando clientWidth contra el ancho pedido, y avisa si no.
"""

import json
import os
import re
import subprocess
import sys
import glob
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRATCH = os.path.join(ROOT, ".check-tmp")
STAGE = os.path.join(SCRATCH, "stage-m")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT = 8902
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")

MEASURE = """
  const imgs = [...d.querySelectorAll('img')];
  imgs.forEach(im => { im.loading = 'eager'; });
  await new Promise(r => setTimeout(r, 600));

  const de = d.documentElement;
  const vw = de.clientWidth;

  // El recorte se busca en ancestros LOCALES. html y body quedan afuera a propósito: su
  // overflow-x: hidden es justamente el que esconde el problema que estamos buscando, y si se
  // los cuenta como "recorte intencional" el checker no puede reportar nada nunca.
  const clipped = el => {
    for (let a = el.parentElement; a && a !== de && a !== d.body; a = a.parentElement) {
      if (w.getComputedStyle(a).overflowX !== 'visible') return true;
    }
    return false;
  };

  // Elementos que se salen del viewport. `scrollWidth` no sirve como señal porque main.css pone
  // overflow-x: hidden en html/body y recorta el desborde sin ensanchar el documento.
  const offenders = [];
  d.querySelectorAll('body *').forEach(el => {
    const cs = w.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') return;
    if (clipped(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const over = Math.max(r.right - vw, -r.left);
    if (over > 1) offenders.push({
      tag: el.tagName.toLowerCase(),
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 56),
      over: +over.toFixed(1), w: +r.width.toFixed(1)
    });
  });
  offenders.sort((a, b) => b.over - a.over);

  // Gutter: cuánto respira el contenido contra el borde derecho.
  let gutter = vw;
  d.querySelectorAll('.lp-section__wrap > *, .lp-hero__wrap > *, .lp-models > li').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0) gutter = Math.min(gutter, vw - r.right);
  });

  // Texto que desborda su propia caja (palabras largas sin cortar).
  const tight = [];
  d.querySelectorAll('h1, h2, h3, p, li, dd, dt, code, a').forEach(el => {
    if (el.scrollWidth - el.clientWidth > 2 && w.getComputedStyle(el).overflowX === 'visible') {
      tight.push({tag: el.tagName.toLowerCase(),
                  cls: (typeof el.className === 'string' ? el.className : '').slice(0, 40),
                  extra: el.scrollWidth - el.clientWidth,
                  text: (el.textContent || '').trim().slice(0, 40)});
    }
  });

  // CTA con altura táctil insuficiente.
  const small = [];
  d.querySelectorAll('.lp-hero__actions a, .lp-cta__actions a, .floating-buttons a').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.height < 44) small.push({
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 40), h: +r.height.toFixed(1)});
  });

  REPORT.textContent = JSON.stringify({
    vw, gutter: +gutter.toFixed(1),
    offenders: offenders.slice(0, 8), tight: tight.slice(0, 6), small: small.slice(0, 6)
  });
"""



def stage():
    subprocess.run(["rm", "-rf", STAGE], check=True)
    os.makedirs(STAGE, exist_ok=True)
    for entry in ("css", "js", "data", "productos", "rtm_logo", "imagenes_productos",
                  "imagenes_productos_restantes", "proyectos_imagenes", "favicon.ico",
                  "index.html", "productos.html"):
        src = os.path.join(ROOT, entry)
        if os.path.exists(src):
            subprocess.run(["cp", "-R", src, STAGE], check=True)
    # sin inyección: la medición corre desde el harness contra el documento del iframe


HARNESS = """<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0">
<iframe id="vp" src="__SRC__" style="width:__W__px;height:3000px;border:0;display:block"></iframe>
<div id="rtm-m" hidden></div>
<script>
document.getElementById('vp').addEventListener('load', async () => {
  const REPORT = document.getElementById('rtm-m');
  const d = document.getElementById('vp').contentDocument;
  const w = document.getElementById('vp').contentWindow;
  __BODY__
});
</script></body></html>"""


def probe(path, width, height=900):
    harness = (HARNESS.replace("__SRC__", path).replace("__W__", str(width))
                      .replace("__BODY__", MEASURE))
    hpath = os.path.join(STAGE, "_harness.html")
    open(hpath, "w", encoding="utf-8").write(harness)
    res = subprocess.run(
        [CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
         "--window-size=1200,1000", f"--user-agent={UA}",
         "--virtual-time-budget=12000", "--dump-dom",
         f"http://localhost:{PORT}/_harness.html"],
        capture_output=True, text=True, timeout=120)
    m = re.search(r'<div id="rtm-m" hidden="?>?"?>(.*?)</div>', res.stdout, re.S)
    if not m:
        return None
    raw = m.group(1)
    for a, b in (("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"')):
        raw = raw.replace(a, b)
    return json.loads(raw)


def main():
    stage()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=STAGE,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2)

    pages = ["/index.html"] + sorted(
        "/productos/" + os.path.basename(p) for p in glob.glob(os.path.join(ROOT, "productos", "*.html")))
    fails = 0
    try:
        for width in (390, 320):
            print(f"\n===== viewport {width} px =====")
            for page in pages:
                r = probe(page, width)
                if r is None:
                    print(f"  {page:42} no se pudo medir"); fails += 1; continue
                if abs(r["vw"] - width) > 2:
                    print(f"  {page:42} EMULACIÓN NO APLICÓ (clientWidth={r['vw']})"); fails += 1; continue

                label = "index (referencia)" if "index" in page else os.path.basename(page)
                # `scrollWidth` NO sirve como señal: main.css pone `overflow-x: hidden` en html/body,
                # así que recorta el desborde y el documento nunca se ensancha. Lo que vale es medir
                # cada elemento contra el viewport.
                if r["offenders"]:
                    fails += 1
                    print(f"  {label:42} DESBORDE ({len(r['offenders'])} elementos, recortado por overflow-x)")
                    for o in r["offenders"]:
                        print(f"      +{o['over']:>6}px  <{o['tag']} class=\"{o['cls']}\"> ancho {o['w']}")
                else:
                    extra = []
                    if r["tight"]:
                        extra.append(f"{len(r['tight'])} textos desbordan su caja")
                    if r["small"]:
                        extra.append(f"{len(r['small'])} CTA <32px de alto")
                    if r.get("gutter") is not None and r["gutter"] < 8:
                        extra.append(f"gutter derecho {r['gutter']}px")
                    print(f"  {label:42} ok{'  ·  ' + '; '.join(extra) if extra else ''}")
                    for t in r["tight"]:
                        print(f"      +{t['extra']}px  <{t['tag']} class=\"{t['cls']}\"> {t['text']!r}")
    finally:
        srv.terminate()

    print("\n" + ("SIN DESBORDES" if fails == 0 else f"{fails} páginas con problemas"))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
