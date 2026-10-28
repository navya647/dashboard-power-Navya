"""Independent check of ui/public/data/sop_master.json against DISCOM_SoP_master.xlsx.

Written separately from extraction_master.py. Compares every column of every row
(joined on id) with the raw workbook values, and checks the lookup tables against
the rows. Exit code 1 on any mismatch.
"""
import json
import sys
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

import openpyxl

HERE = Path(__file__).resolve().parent
XLSX = HERE.parent / "DISCOM_SoP_master.xlsx"
JSON = HERE / "ui" / "public" / "data" / "sop_master.json"

out = json.loads(JSON.read_text(encoding="utf-8"))
by_id = {r["id"]: r for r in out["rows"]}
problems = defaultdict(list)


def flag(kind, msg):
    problems[kind].append(msg)


# --- raw workbook values (data_only, no formatting applied here) ---
wb = openpyxl.load_workbook(XLSX, data_only=True)
sheet = wb.worksheets[0]
it = sheet.iter_rows()
head = [c.value for c in next(it)]
xl_rows = []
for line in it:
    vals = {h: (c.value, c.number_format) for h, c in zip(head, line)}
    if all(v is None for v, _ in vals.values()):
        continue
    xl_rows.append(vals)

if len(xl_rows) != len(out["rows"]):
    flag("row count", f"xlsx {len(xl_rows)} vs json {len(out['rows'])}")
if len(by_id) != len(out["rows"]):
    flag("row count", "duplicate ids in json")

for pos, x in enumerate(xl_rows):
    rid = x["id"][0]
    j = by_id.get(rid)
    if j is None:
        flag("missing id", rid)
        continue
    if out["rows"][pos]["id"] != rid:
        flag("order", f"row {pos + 2}: xlsx {rid} json {out['rows'][pos]['id']}")
    for col in head:
        raw, fmt = x[col]
        got = j.get(col)
        if raw is None:
            if got is not None:
                flag(col, f"{rid}: blank in xlsx, json {got!r}")
        elif isinstance(raw, str):
            if got != raw:
                flag(col, f"{rid}: xlsx {raw!r} json {got!r}")
        else:
            # numeric: json text must denote the same quantity at the format's precision
            if not isinstance(got, str):
                flag(col, f"{rid}: numeric {raw!r} but json {got!r}")
                continue
            if fmt.endswith("%"):
                places = len(fmt.split(".")[1].rstrip("%")) if "." in fmt else 0
                want = Decimal(str(raw)) * 100
                if not got.endswith("%") or abs(Decimal(got[:-1]) - want) > Decimal(1).scaleb(-places) / 2 + Decimal("1e-9"):
                    flag(col, f"{rid}: xlsx {raw!r} [{fmt}] json {got!r}")
            elif Decimal(got) != Decimal(str(raw)):
                flag(col, f"{rid}: xlsx {raw!r} json {got!r}")
    extra = set(j) - set(head) - {"standardised_num"}
    if extra:
        flag("extra fields", f"{rid}: {sorted(extra)}")

    # plotting number must equal the displayed standardised figure, or be absent
    sd, num = j.get("standardised_data"), j.get("standardised_num")
    if num is not None:
        try:
            shown = float(sd.rstrip("%"))
        except (ValueError, AttributeError):
            flag("standardised_num", f"{rid}: num {num} but text {sd!r}")
        else:
            if abs(shown - num) > 0.006:
                flag("standardised_num", f"{rid}: num {num} text {sd!r}")

# --- lookup tables agree with the rows ---
fam_seen = defaultdict(set)
disc_seen = defaultdict(set)
for r in out["rows"]:
    fam_seen[r["indicator_family_id"]].add((r["indicator_family"], r["unit"]))
    disc_seen[(r["state"], r["discom_code"])].add(r["discom_name"])
for fid, variants in fam_seen.items():
    if len(variants) > 1:
        flag("family varies", f"{fid}: {sorted(variants)}")
    t = out["families"].get(fid)
    if t is None or (t["name"], t["unit"]) not in variants:
        flag("families table", f"{fid}: {t}")
for (st, code), names in disc_seen.items():
    listed = [d for d in out["states"].get(st, {}).get("discoms", []) if d["code"] == code]
    if len(listed) != 1 or listed[0]["name"] not in names or len(names) > 1:
        flag("states table", f"{st}/{code}: listed {listed}, rows {sorted(names)}")

# --- report ---
print(f"rows: xlsx {len(xl_rows)}, json {len(out['rows'])}")
print(f"values checked vs xlsx: {len(xl_rows) * len(head)}")
for col in head:
    print(f"  {col:24s} mismatches {len(problems.get(col, [])):5d}")
for kind, msgs in problems.items():
    if kind in head:
        continue
    print(f"[{kind}] {len(msgs)}")
for kind, msgs in problems.items():
    for m in msgs[:20]:
        print(f"  {kind}: {m}")
sys.exit(1 if problems else 0)
