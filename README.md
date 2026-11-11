# SPIN Tenis de Mesa — sitio del club

> **El sitio se mudó** a **https://pereyrapablojavier.github.io/clubes-tdm/spin-tdm/** (repo [clubes-tdm](https://github.com/pereyrapablojavier/clubes-tdm), un mismo sitio para varios clubes).
> Esta dirección redirige allá conservando la sección (`#/…`), la app vieja se da de baja sola y los favoritos se migran.
> La Action de actualización de este repo está apagada: los datos se actualizan en clubes-tdm. Lo que sigue queda como historial.

Sitio web del **Club SPIN Tenis de Mesa** (Villa Crespo · Villa Pueyrredón · Saavedra, CABA) con el plantel completo y las estadísticas de cada jugador, tomadas de:

- **TMT – Tenis de Mesa para Todos**: rating, ranking, categoría, torneos, partidos, efectividad, podios, últimos 20 torneos con el detalle de cada partido.
- **FETEMBA**: rating y puesto en el ranking federado, historial de rating, partidos por año, palmarés, individuales/dobles/equipos, y los resultados en Grand Slam y Super Series.

## Cómo funciona

| Carpeta | Qué hay |
|---|---|
| `index.html`, `assets/` | El sitio (HTML + CSS + JS, sin dependencias externas). |
| `data/tmt_raw.json`, `data/fet_raw.json` | Datos descargados de TMT y FETEMBA. |
| `data/club.json`, `data/players.json`, `data/calendar.json`, `data/equipos.json`, `data/circuito.json` | Datos procesados que usa el sitio (`circuito.json`: Grand Slam y Super Series de FETEMBA). |
| `scripts/scrape.py` | Descarga los datos del club desde TMT y FETEMBA. |
| `scripts/equipos.py` | Descarga la Liga de Equipos y la Copa de Clubes desde fetembaequipos.ar. |
| `scripts/build.py` | Combina los datos (genera `_site/`; el workflow copia los JSON a `data/`). |
| `.github/workflows/` | GitHub Action que actualiza los datos (lunes y jueves). GitHub Pages publica desde la rama `main`. |

Para actualizar a mano: pestaña **Actions → "Actualizar datos" → Run workflow** y marcar qué actualizar
(jugadores, calendario, Liga/Copa y/o Grand Slam y Super Series). La corrida automática actualiza todo.

`scrape.py` también acepta partes sueltas: `calendario`, `jugadores` o `circuito` (Grand Slam y Super Series; solo vuelve a bajar todo si FETEMBA cargó un torneo nuevo o más partidos).

### Probar localmente

```bash
pip install -r requirements.txt
python scripts/scrape.py   # opcional: baja datos nuevos
python scripts/build.py
python -m http.server -d _site 8000
```

## Aviso

La información que muestra el sitio es **pública** y se consulta a [TMT](https://www.tenisdemesaparatodos.com/), [FETEMBA](https://fetemba.bsweb.com.ar/) y [FETEMBA Equipos](https://fetembaequipos.ar/). Los datos **no nos pertenecen**: son propiedad de sus respectivas fuentes. El sitio no es oficial de TMT ni de FETEMBA. Instagram del club: [@spintdmarg](https://www.instagram.com/spintdmarg/).

© 2026 Pablo Javier Pereyra — diseño y desarrollo del sitio.
