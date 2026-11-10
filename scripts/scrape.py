"""Descarga los datos de los jugadores del Club SPIN desde TMT y FETEMBA.

Genera:
  data/tmt_raw.json  - jugadores del club en Tenis de Mesa para Todos (TMT)
  data/fet_raw.json  - datos del club y sus jugadores en FETEMBA

Uso:  python scripts/scrape.py
"""
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

TMT = "https://www.tenisdemesaparatodos.com"
FET = "https://fetemba.bsweb.com.ar"
TMT_CLUB = 234          # Spin TDM en TMT
FET_CLUB = 76           # Spin TDM en FETEMBA
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

S = requests.Session()
S.headers["User-Agent"] = "Mozilla/5.0 (club SPIN stats bot; +https://github.com)"


def get(url, binary=True, tries=4):
    for k in range(tries):
        try:
            r = S.get(url, timeout=40)
            r.raise_for_status()
            return r.content.decode("windows-1252", errors="replace") if binary else r.json()
        except Exception as e:  # noqa
            if k == tries - 1:
                print("ERROR", url, e, file=sys.stderr)
                return None
            time.sleep(2 * (k + 1))


# ---------------------------------------------------------------- TMT parsing
def page_text(html):
    soup = BeautifulSoup(html, "html.parser")
    for t in soup(["script", "style"]):
        t.decompose()
    t = soup.get_text("\n")
    t = re.sub(r"[\t\r \xa0]+", " ", t)
    return re.sub(r"\s*\n\s*", "\n", t)


def m1(t, pat):
    m = re.search(pat, t)
    return m.group(1).strip() if m else None


def parse_roster(html):
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for tr in soup.find_all("tr"):
        if tr.find("table"):
            continue
        tds = tr.find_all("td", recursive=False)
        a = tr.find("a", href=re.compile("jugadores_ficha"))
        if len(tds) != 6 or not a:
            continue
        c = [td.get_text(" ", strip=True) for td in tds]
        img = tr.find("img", src=re.compile("icono_puesto"))
        cat = re.search(r"puesto_(\w+)\.gif", img["src"]).group(1) if img else ""
        out.append({"pos": int(c[0]), "code": c[1], "name": c[2].strip(), "cat": cat,
                    "rating": int(c[4] or 0), "age": int(c[5] or 0)})
    return out


def parse_stats(t):
    s = t.split("ESTADISTICAS", 1)[1] if "ESTADISTICAS" in t else ""
    n = lambda p: int(m1(s, p) or 0)  # noqa
    return {"ingreso": m1(s, r"Ingreso al circuito:\s*([\d/]+)"),
            "ultimo": m1(s, r"Último torneo disputado:\s*([\d/]+)"),
            "torneos": n(r"(\d+)\s*torneos? disputados?"), "partidos": n(r"(\d+)\s*partidos jugados"),
            "ganados": n(r"(\d+)\s*partidos ganados"), "p1": n(r"1er puesto:\s*(\d+)"),
            "p2": n(r"2do puesto:\s*(\d+)"), "p3": n(r"3er puesto:\s*(\d+)")}


LABELS = ("Madera:", "Goma drive:", "Goma revés:", "Mano hábil:", "DATOS PERSONALES")


def field(t, label):
    v = m1(t, re.escape(label) + r"[ ]*\n?([^\n]*)") or ""
    return "" if v.startswith(LABELS) else v


def parse_ficha(t):
    mano = m1(t, r"Mano hábil:\n([^\n]+)") or ""
    fet = None
    if "DATOS FETEMBA" in t:
        fet = {"code": m1(t, r"Código FETEMBA:\n([^\n]+)"),
               "club": m1(t, r"DATOS FETEMBA[\s\S]*?Club:\n([^\n]+)")}
    return {"rankPos": m1(t, r"Posición en el ranking:\n([^\n]+)"),
            "var": m1(t, r"Variación último ranking:\n([^\n]+)"),
            "madera": field(t, "Madera:"), "drive": field(t, "Goma drive:"),
            "reves": field(t, "Goma revés:"),
            "mano": "" if mano.startswith("Goma") else mano,
            "nac": m1(t, r"Nacionalidad:\n([^\n]+)"), "fet": fet, "tot": parse_stats(t)}


def fix_name(s):
    return re.sub(r"(\d+)\? ", r"\1º ", s).strip()


def num(s):
    try:
        return int(s)
    except (TypeError, ValueError):
        return 0


def parse_matches(html, code):
    soup = BeautifulSoup("<table>" + html + "</table>", "html.parser")
    tb = soup.find("table")
    rows = tb.find_all("tr", recursive=False) if tb else []
    T = lambda e: re.sub(r"\s+", " ", e.get_text(" ")).strip()  # noqa
    out, cur, phase, i = [], None, "", 0
    while i < len(rows):
        r = rows[i]
        tn = r.find(class_="tournament-name")
        if tn:
            a = tn.find("a")
            v = r.find("div", attrs={"align": "right"})
            cur = {"date": T(tn).split(" - ")[0].strip(), "name": fix_name(T(a)) if a else "",
                   "tid": a["href"].split("=")[1] if a else "", "var": num(T(v)) if v else 0, "m": []}
            out.append(cur)
            i += 1
            continue
        cells = r.find_all("td", recursive=False)
        if len(cells) == 1 and cells[0].get("colspan") == "10" and T(r):
            phase = T(r)
            i += 1
            continue
        nxt = rows[i + 1].find_all("td", recursive=False) if i + 1 < len(rows) else []
        la = r.find("a", href=re.compile("jugadores_ficha"))
        if len(cells) == 10 and la and len(nxt) == 10:
            A = [T(c) for c in cells]
            B = [T(c) for c in nxt]
            ca = la["href"].split("=")[1]
            lb = rows[i + 1].find("a", href=re.compile("jugadores_ficha"))
            cb = lb["href"].split("=")[1] if lb else ""
            mine = ca == code
            me, op, opc = (A, B, cb) if mine else (B, A, ca)
            sets = [f"{me[k]}-{op[k]}" for k in range(1, 6) if num(me[k]) or num(op[k])]
            if cur is not None:
                cur["m"].append({"ph": phase, "op": op[0], "opc": opc, "sets": sets,
                                 "w": num(me[6]) > num(op[6]), "res": f"{me[6]}-{op[6]}",
                                 "r": num(me[7]), "or": num(op[7]), "v": num(me[8])})
            i += 2
            continue
        i += 1
    return out


def scrape_tmt_player(p):
    code = p["code"]
    f = get(f"{TMT}/jugadores_ficha.asp?codigo={code}")
    f12 = get(f"{TMT}/jugadores_ficha.asp?codigo={code}&est=12meses")
    f6 = get(f"{TMT}/jugadores_ficha.asp?codigo={code}&est=6meses")
    mh = get(f"{TMT}/matches.asp?player-id={code}")
    o = dict(p)
    o.update(parse_ficha(page_text(f)) if f else {})
    o["y1"] = parse_stats(page_text(f12)) if f12 else None
    o["m6"] = parse_stats(page_text(f6)) if f6 else None
    o["t"] = parse_matches(mh, code) if mh else []
    return o


def club_rank():
    """Posición del club en el Ranking de Clubes de TMT."""
    html = get(f"{TMT}/rankingClubes.asp")
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")
    a = soup.find("a", href=re.compile(rf"clubes_ampliar\.asp\?codigo={TMT_CLUB}\b"))
    tr = a.find_parent("tr") if a else None
    while tr is not None:
        m = re.match(r"\s*(\d+)\s*°?", tr.get_text(" ", strip=True))
        if m:
            return int(m.group(1))
        tr = tr.find_parent("tr")
    return None


# ------------------------------------------------------------ FETEMBA parsing
def thin(a, n):
    if len(a) <= n:
        return a
    return [a[round(i * (len(a) - 1) / (n - 1))] for i in range(n)]


def scrape_fet_player(fc):
    a = get(f"{FET}/api/publico/jugadores/{fc}", binary=False)
    if not a:
        return None
    b = get(f"{FET}/api/publico/historial/jugadores/{fc}", binary=False) or {}
    return {"id": fc, "nombre": a.get("nombre"), "club": (a.get("club") or {}).get("nombre"),
            "rating": a.get("rating"), "activo": a.get("activo"), "vigente": a.get("vigente"),
            "res": b.get("resumen"),
            "anios": [{"y": x["anio"], "p": x["partidos"], "g": x["ganados"], "t": x["titulos"],
                       "pod": x["podios"], "club": (x.get("club") or {}).get("nombre")} for x in b.get("anios") or []],
            "rating_hist": thin([[r["fecha"], r["puntos"], r["posicion"]] for r in b.get("rating") or []], 80),
            "pal": [{"f": x["fecha"], "ev": x["evento"], "tipo": x["tipo"], "cat": x["categoria"], "pu": x["puesto"]}
                    for x in (b.get("palmares") or [])[:25]],
            "clases": b.get("por_clase") or []}


def main():
    DATA.mkdir(exist_ok=True)
    club_html = get(f"{TMT}/clubes_ampliar.asp?codigo={TMT_CLUB}")
    roster = parse_roster(club_html) if club_html else []
    if len(roster) < 10:
        sys.exit("No se pudo leer el plantel de TMT; se conservan los datos anteriores.")
    with ThreadPoolExecutor(4) as ex:
        players = list(ex.map(scrape_tmt_player, roster))
    now = datetime.now(timezone.utc).isoformat()
    club_info = {"code": TMT_CLUB, "rank": club_rank()}
    (DATA / "tmt_raw.json").write_text(json.dumps({"updated": now, "club": club_info, "players": players},
                                                  ensure_ascii=False))
    print("TMT:", len(players), "jugadores")

    club = get(f"{FET}/api/publico/clubes/{FET_CLUB}", binary=False)
    if not club:
        print("FETEMBA no disponible; se conservan los datos anteriores.")
        return
    by_tmt = {p["code"]: p["fet"]["code"] for p in players if p.get("fet") and p["fet"].get("code")}
    fet_ids = {str(j["id"]) for j in club["jugadores"]}
    with ThreadPoolExecutor(4) as ex:
        bt = dict(zip(by_tmt.keys(), ex.map(scrape_fet_player, by_tmt.values())))
        linked = {str(v) for v in by_tmt.values()}
        only_ids = [i for i in fet_ids if i not in linked]
        fo = dict(zip(only_ids, ex.map(scrape_fet_player, only_ids)))
    out = {"updated": now,
           "club": {k: club.get(k) for k in ("id", "nombre", "datos", "delegados", "ranking", "jugadores")},
           "byTmt": {k: v for k, v in bt.items() if v}, "fetOnly": {k: v for k, v in fo.items() if v}}
    (DATA / "fet_raw.json").write_text(json.dumps(out, ensure_ascii=False))
    print("FETEMBA:", len(out["byTmt"]), "vinculados +", len(out["fetOnly"]), "solo FETEMBA")


if __name__ == "__main__":
    main()
