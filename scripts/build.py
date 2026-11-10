"""Arma el sitio estático en _site/ a partir de data/tmt_raw.json y data/fet_raw.json.

Uso:  python scripts/build.py
"""
import json
import re
import shutil
import unicodedata
from collections import defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "_site"

CAT_ORDER = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "7ma", "8va"]


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z, ]", "", s).strip()


def name_key(n):
    """'Apellido, Nombre Segundo' -> ('apellido', 'nombre')"""
    n = norm(n)
    if "," in n:
        sur, given = n.split(",", 1)
    else:
        sur, given = n, ""
    return sur.strip(), (given.split() or [""])[0]


def dmy(s):
    try:
        return datetime.strptime(s, "%d/%m/%Y").strftime("%Y-%m-%d")
    except (TypeError, ValueError):
        return None


def pct(g, p):
    return round(100 * g / p) if p else None


def clean(s):
    return (s or "").strip()


def strip_club(n):
    """'Etayo, Alejandro (FNX)' -> ('Etayo, Alejandro', 'FNX')"""
    m = re.match(r"^(.*?)\s*\((\w+)\)\s*$", n or "")
    return (m.group(1), m.group(2)) if m else (n, "")


def fet_block(f):
    if not f:
        return None
    years = defaultdict(lambda: {"p": 0, "g": 0, "t": 0, "pod": 0})
    for a in f.get("anios") or []:
        y = years[a["y"]]
        for k in ("p", "g", "t", "pod"):
            y[k] += a.get(k) or 0
    v = f.get("vigente") or {}
    return {"id": f["id"], "club": f.get("club"), "rating": f.get("rating"), "activo": f.get("activo"),
            "pos": v.get("posicion"), "cat": v.get("categoria"), "ranking": v.get("ranking"),
            "publicado": v.get("publicado"), "res": f.get("res"),
            "years": [{"y": y, **years[y]} for y in sorted(years)],
            "hist": f.get("rating_hist") or [], "pal": f.get("pal") or [], "clases": f.get("clases") or []}


def build():
    tmt = json.loads((DATA / "tmt_raw.json").read_text())
    fet = json.loads((DATA / "fet_raw.json").read_text())
    fet_club = fet.get("club") or {}
    fet_roster = {str(j["id"]): j for j in fet_club.get("jugadores") or []}

    players = {}
    spin_codes = set()
    for p in tmt["players"]:
        spin_codes.add(p["code"])
    # --- TMT players
    for p in tmt["players"]:
        code = p["code"]
        tours = []
        for t in p.get("t") or []:
            ms = t.get("m") or []
            pre = ms[0]["r"] if ms else None
            matches = []
            for m in ms:
                opn, opclub = strip_club(m["op"])
                matches.append({"ph": m["ph"], "op": opn, "oc": opclub, "opc": m["opc"], "sets": m["sets"],
                                "w": m["w"], "res": m["res"], "or": m["or"], "v": m["v"],
                                "spin": m["opc"] in spin_codes})
            tours.append({"date": dmy(t["date"]), "name": t["name"], "tid": t["tid"], "var": t["var"],
                          "pre": pre, "post": (pre + t["var"]) if pre is not None else None,
                          "w": sum(1 for m in matches if m["w"]), "l": sum(1 for m in matches if not m["w"]),
                          "m": matches})
        tours.sort(key=lambda t: t["date"] or "", reverse=True)
        all_m = [m for t in tours for m in t["m"]]
        form = [("G" if m["w"] else "P") for t in tours for m in t["m"]][:10]
        upsets = sorted([dict(m, date=t["date"], torneo=t["name"], diff=m["or"] - (t["pre"] or 0))
                         for t in tours for m in t["m"] if m["w"]], key=lambda m: -m["diff"])[:5]
        sets_w = sum(int(s.split("-")[0] or 0) > int(s.split("-")[1] or 0) for m in all_m for s in m["sets"] if "-" in s)
        sets_l = sum(int(s.split("-")[0] or 0) < int(s.split("-")[1] or 0) for m in all_m for s in m["sets"] if "-" in s)
        deciders = [m for m in all_m if len(m["sets"]) == 5]
        players[code] = {
            "id": code, "name": p["name"], "src": ["tmt"],
            "tmt": {"code": code, "cat": p["cat"], "rating": p["rating"], "clubPos": p["pos"],
                    "rankPos": int(p["rankPos"]) if (p.get("rankPos") or "").isdigit() else None,
                    "var": p.get("var"), "tot": p.get("tot"), "y1": p.get("y1"), "m6": p.get("m6"),
                    "ingreso": dmy((p.get("tot") or {}).get("ingreso")),
                    "ultimo": dmy((p.get("tot") or {}).get("ultimo")),
                    "tours": tours, "form": form, "upsets": upsets,
                    "recent": {"w": sum(m["w"] for m in all_m), "l": sum(not m["w"] for m in all_m),
                               "sets_w": sets_w, "sets_l": sets_l,
                               "dec_w": sum(m["w"] for m in deciders), "dec_l": sum(not m["w"] for m in deciders),
                               "delta": sum(t["var"] for t in tours)}},
            "equipo": {"madera": clean(p.get("madera")), "drive": clean(p.get("drive")),
                       "reves": clean(p.get("reves")), "mano": clean(p.get("mano"))},
            "fet": fet_block((fet.get("byTmt") or {}).get(code)),
        }
    # --- FETEMBA-only players: link by name if possible
    by_key = defaultdict(list)
    for pl in players.values():
        by_key[name_key(pl["name"])].append(pl)
    for fid, f in (fet.get("fetOnly") or {}).items():
        k = name_key(f["nombre"])
        cand = [pl for pl in by_key.get(k, []) if not pl["fet"]]
        fb = fet_block(f)
        if len(cand) == 1:
            cand[0]["fet"] = fb
        else:
            pid = "f" + str(fid)
            players[pid] = {"id": pid, "name": f["nombre"], "src": ["fet"], "tmt": None,
                            "equipo": None, "fet": fb}
    for pl in players.values():
        if pl["fet"]:
            if "fet" not in pl["src"]:
                pl["src"].append("fet")
            pl["fet"]["spin"] = str(pl["fet"]["id"]) in fet_roster

    # --- summary list
    summary = []
    for pl in players.values():
        t, f = pl["tmt"], pl["fet"]
        y1 = (t or {}).get("y1") or {}
        tot = (t or {}).get("tot") or {}
        summary.append({
            "id": pl["id"], "name": pl["name"], "src": pl["src"],
            "cat": t["cat"] if t else None, "rating": t["rating"] if t else None,
            "rankPos": t["rankPos"] if t else None, "clubPos": t["clubPos"] if t else None,
            "pj": tot.get("partidos"), "pg": tot.get("ganados"), "wr": pct(tot.get("ganados", 0), tot.get("partidos", 0)),
            "pj12": y1.get("partidos"), "wr12": pct(y1.get("ganados", 0), y1.get("partidos", 0)),
            "tor12": y1.get("torneos"), "torneos": tot.get("torneos"),
            "pod": (tot.get("p1", 0) + tot.get("p2", 0) + tot.get("p3", 0)) if t else None,
            "tit": tot.get("p1") if t else None,
            "form": t["form"][:5] if t else [], "delta": t["recent"]["delta"] if t else None,
            "ultimo": t["ultimo"] if t else None,
            "fr": f["rating"] if f else None, "fpos": f["pos"] if f else None, "fcat": f["cat"] if f else None,
            "fclub": f["club"] if f else None, "factivo": f["activo"] if f else None,
            "spark": [x["post"] for x in reversed(t["tours"]) if x["post"]] if t else [],
        })
    summary.sort(key=lambda s: (s["rating"] is None, -(s["rating"] or 0), -(s["fr"] or 0)))

    # --- club level aggregates
    tmt_pl = [p for p in players.values() if p["tmt"]]
    cats = {c: sum(1 for p in tmt_pl if p["tmt"]["cat"] == c) for c in CAT_ORDER}
    ages = [p["age"] for p in tmt["players"] if p.get("age")]
    # tournaments where SPIN players played recently
    tourn = {}
    for p in tmt_pl:
        for t in p["tmt"]["tours"]:
            e = tourn.setdefault(t["tid"], {"tid": t["tid"], "date": t["date"], "name": t["name"],
                                            "players": [], "w": 0, "l": 0})
            e["players"].append({"id": p["id"], "name": p["name"], "w": t["w"], "l": t["l"], "var": t["var"]})
            e["w"] += t["w"]
            e["l"] += t["l"]
    recent_t = sorted(tourn.values(), key=lambda t: t["date"] or "", reverse=True)[:30]
    for t in recent_t:
        t["players"].sort(key=lambda x: (-x["w"], x["l"]))
    # top lists
    ups = []
    for p in tmt_pl:
        for u in p["tmt"]["upsets"][:2]:
            ups.append({"id": p["id"], "name": p["name"], **{k: u[k] for k in ("op", "oc", "or", "res", "date", "torneo", "diff")}})
    ups.sort(key=lambda u: -u["diff"])
    # internal SPIN derby matches
    derbies = {}
    for p in tmt_pl:
        for t in p["tmt"]["tours"]:
            for m in t["m"]:
                if m["spin"] and m["w"]:
                    key = (t["tid"], p["id"], m["opc"], m["res"], tuple(m["sets"]))
                    derbies[key] = {"date": t["date"], "torneo": t["name"], "winner": p["name"], "wid": p["id"],
                                    "loser": m["op"], "lid": m["opc"], "res": m["res"]}
    derby_list = sorted(derbies.values(), key=lambda d: d["date"] or "", reverse=True)[:40]
    total_recent = {"w": sum(p["tmt"]["recent"]["w"] for p in tmt_pl), "l": sum(p["tmt"]["recent"]["l"] for p in tmt_pl)}
    tot_all = {k: sum(((p["tmt"]["tot"] or {}).get(k) or 0) for p in tmt_pl) for k in ("partidos", "ganados", "torneos", "p1", "p2", "p3")}
    y1_all = {k: sum(((p["tmt"]["y1"] or {}).get(k) or 0) for p in tmt_pl) for k in ("partidos", "ganados", "torneos", "p1", "p2", "p3")}

    fd = fet_club.get("datos") or {}
    club = {
        "updated": tmt.get("updated"), "fet_updated": fet.get("updated"),
        "nombre": "SPIN Tenis de Mesa", "sigla": "SPI",
        "tmt_code": tmt["club"]["code"], "tmt_rank": tmt["club"].get("rank"), "fet_id": fet_club.get("id"),
        "direccion": fd.get("direccion"), "localidad": fd.get("localidad"), "horarios": fd.get("horarios"),
        "instalaciones": fd.get("instalaciones"), "como_llegar": fd.get("como_llegar"),
        "instagram": "https://www.instagram.com/spintdmarg/",
        "sedes": [{"nombre": "Villa Crespo", "dir": "Antezana 340", "lugar": "Asociación Benito Nazar", "dias": "Lunes a sábados"},
                  {"nombre": "Villa Pueyrredón", "dir": "Terrada 4342", "lugar": "Club La Emiliana", "dias": "Lunes, miércoles, jueves y viernes"},
                  {"nombre": "Saavedra", "dir": "Pico 3540", "lugar": "Asociación Vecinal Loma de Saavedra", "dias": "Lunes, miércoles y viernes"}],
        "entrenadores": ["Darío Neira", "Rodrigo Ezequiel Delgadillo", "Giselle Muñoz"],
        "stats": {
            "tmt_players": len(tmt_pl), "fet_players": len(fet_roster),
            "total_players": len(players),
            "avg_age": round(sum(ages) / len(ages)) if ages else None,
            "tmt_rating_total": sum(p["tmt"]["rating"] for p in tmt_pl),
            "tmt_rating_avg": round(sum(p["tmt"]["rating"] for p in tmt_pl) / len(tmt_pl)) if tmt_pl else None,
            "cats": cats, "tot": tot_all, "y1": y1_all, "recent": total_recent,
            "fet_ranked": sum(1 for j in fet_roster.values() if j.get("posicion")),
            "fet_cats": dict(sorted(_count(j.get("categoria") for j in fet_roster.values()).items())),
        },
        "tournaments": recent_t, "upsets": ups[:12], "derbies": derby_list,
        "players": summary,
    }

    # --- write
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "data").mkdir(parents=True)
    for name in ("index.html", "404.html", "manifest.webmanifest", "sw.js"):
        if (ROOT / name).exists():
            shutil.copy(ROOT / name, OUT / name)
    shutil.copytree(ROOT / "assets", OUT / "assets")
    (OUT / ".nojekyll").write_text("")
    (OUT / "data" / "club.json").write_text(json.dumps(club, ensure_ascii=False, separators=(",", ":")))
    (OUT / "data" / "players.json").write_text(json.dumps(players, ensure_ascii=False, separators=(",", ":")))
    print(f"Sitio generado en {OUT} — {len(players)} jugadores")


def _count(it):
    d = defaultdict(int)
    for x in it:
        if x:
            d[x] += 1
    return d


if __name__ == "__main__":
    build()
