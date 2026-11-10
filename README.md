# SPIN Tenis de Mesa — sitio del club

Sitio web del **Club SPIN Tenis de Mesa** (Villa Crespo · Villa Pueyrredón · Saavedra, CABA) con el plantel completo y las estadísticas de cada jugador, tomadas de:

- **TMT – Tenis de Mesa para Todos**: rating, ranking, categoría, torneos, partidos, efectividad, podios, últimos 20 torneos con el detalle de cada partido.
- **FETEMBA**: rating y puesto en el ranking federado, historial de rating, partidos por año, palmarés, individuales/dobles/equipos.

## Cómo funciona

| Carpeta | Qué hay |
|---|---|
| `index.html`, `assets/` | El sitio (HTML + CSS + JS, sin dependencias externas). |
| `data/tmt_raw.json`, `data/fet_raw.json` | Datos descargados de TMT y FETEMBA. |
| `data/club.json`, `data/players.json` | Datos procesados que usa el sitio. |
| `scripts/scrape.py` | Descarga los datos del club desde TMT y FETEMBA. |
| `scripts/build.py` | Combina los datos (genera `_site/`; el workflow copia los JSON a `data/`). |
| `.github/workflows/` | GitHub Action que actualiza los datos (lunes y jueves). GitHub Pages publica desde la rama `main`. |

Para actualizar a mano: pestaña **Actions → "Actualizar datos" → Run workflow**.

### Probar localmente

```bash
pip install -r requirements.txt
python scripts/scrape.py   # opcional: baja datos nuevos
python scripts/build.py
python -m http.server -d _site 8000
```

Los datos son públicos y pertenecen a sus respectivas fuentes. Instagram del club: [@spintdmarg](https://www.instagram.com/spintdmarg/).
