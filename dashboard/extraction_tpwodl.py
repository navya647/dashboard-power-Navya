"""Overlay TPWODL's Pass 1 "Main" sheets onto the two live JSON datasets.

Source: ../TPWODL_Pass1_Pass2_2026-10-22/Pass1/TPWODL_FY<yyyy-yy>_Pass1_Dashboard_*.xlsx, sheet `Main`
(one row per indicator per FY, narrative columns). Run AFTER extraction_common.py and
extraction_state_specific.py (those still read the older TPWODL sheets), from `dashboard/`:

    python3 extraction_tpwodl.py

Only TPWODL is touched, in ui/public/data/discoms2.json and ui/public/data/state_specific.json.
What Main covers replaces the old values; what it does not cover (CAIDI, Harmonics, Billing
Complaint Resolution, Voltage Unbalance) is left exactly as it was. Standards text, verdicts
("Comparison possible?", "Standard met?") and reasons come straight from Main. No figure is derived:
a combined Urban+Rural value is shown only where Main itself gives one.
"""
import copy, glob, json, re
import openpyxl
from extraction_common import score_year, CANONICAL_ORDER

PASS1 = '../TPWODL_Pass1_Pass2_2026-10-22/Pass1'
DISCOMS_JSON = 'ui/public/data/discoms2.json'
SOP_JSON = 'ui/public/data/state_specific.json'
SHORT = 'TPWODL'

REL_MAP = {
    'System Average Interruption Duration Index (SAIDI)': 'SAIDI',
    'System Average Interruption Frequency Index (SAIFI)': 'SAIFI',
    'Momentary Average Interruption Frequency Index (MAIFI)': 'MAIFI',
    'Supply voltage at point of supply outside limits — number of cases (EHT / HT / LT)': 'VOLTAGE VARIATION',
    'Distribution transformer failure restoration — share resolved within standard': 'TRANSFORMER FAILURE',
}
# Main indicator -> [(SoP indicator name as the sibling Odisha DISCOMs spell it, area or None)]
SOP_MAP = {
    'Normal fuse-off call rectification — share resolved within standard':
        [('Fuse-off calls: Urban', 'Urban'), ('Fuse-off calls: Rural', 'Rural')],
    'Line breakdown restoration — share resolved within standard':
        [('Line breakdown: Urban', 'Urban'), ('Line breakdown: Rural', 'Rural')],
    'Scheduled outage restoration — share resolved within standard':
        [('Scheduled Outage: Restoration of Supply by 6:00 PM', None)],
    'Street-light fault rectification — share resolved within standard': [('Street light fault', None)],
    'Billing mistakes — faulty bills as share of bills issued': [('Faulty bills', None)],
    'Defective meters — share of meters in service': [('Faulty/defective meters', None)],
    'Supply frequency outside ±3% of 50 Hz — number of hourly measurements': [('Supply frequency', None)],
    'Fatal electrical accidents — humans': [('Fatal Human Accidents', None)],
    'Non-fatal electrical accidents — humans': [('Non-fatal Human Accidents', None)],
    'Fatal electrical accidents — animals': [('Fatal Animal Accidents', None)],
    'Non-fatal electrical accidents — animals': [('Non-fatal Animal Accidents', None)],
}
NUM = r'(\d[\d,]*(?:\.\d+)?)'


def num(s):
    return float(s.replace(',', ''))


def yn(x):
    x = str(x).strip().upper()
    return True if x == 'YES' else False if x == 'NO' else None


def load_main():
    """{year: {indicator: row dict}} plus {year: {SAIDI/SAIFI/MAIFI: definition}}."""
    out, defs = {}, {}
    for f in sorted(glob.glob(f'{PASS1}/TPWODL_FY*_Pass1_Dashboard_*.xlsx')):
        wb = openpyxl.load_workbook(f, data_only=True)
        for r in list(wb['Main'].iter_rows(min_row=2, values_only=True)):
            if not r[0]:
                continue
            year = str(r[2]).replace('FY ', '').strip()
            out.setdefault(year, {})[r[4].strip()] = {
                'standard': r[5], 'reported': r[6], 'annualised': r[7], 'comparable': yn(r[8]),
                'met': yn(r[9]), 'reason': r[10], 'doc': r[12]}
            if year not in defs:
                defs[year] = {str(d[0]).strip(): d[1] for d in wb['Definitions_Units'].iter_rows(min_row=2, values_only=True) if d[0]}
    return out, defs


def parse_shares(g):
    m = re.search(rf'Urban {NUM}%; Rural {NUM}%', g)
    return (num(m.group(1)), num(m.group(2))) if m else None


def parse_last(g):
    """The single figure after the final ': ' (share, index or count)."""
    if g.startswith('No value reported'):
        return None
    m = re.search(rf':\s*{NUM}%?\.?\s*$', g)
    return num(m.group(1)) if m else None


def parse_voltage(g):
    if g.startswith('No value reported'):
        return None, None
    m = re.search(rf'\(HT, FY, annual reporting\):\s*{NUM}', g)
    ht = num(m.group(1)) if m else None
    if ht is None:
        m = re.search(rf'\bHT {NUM}', g)
        ht = num(m.group(1)) if m else None
    m = re.search(rf'\bLT {NUM}', g)
    return ht, (num(m.group(1)) if m else None)


def benchmark(std):
    """A numeric threshold only where the standard text states exactly one percentage limit."""
    m = re.match(rf'(?:At least|.*? not more than) {NUM}%', std or '')
    return num(m.group(1)) if m else None


def combined_share(annualised):
    m = re.match(rf'FY within-standard share: {NUM}%', annualised or '')
    return num(m.group(1)) if m else None


def clean_doc(d):
    d = (d or '').strip()
    return None if d.lower().startswith('none') or not d else d


def patch_reliability(t, main, defs):
    for year, yd in t['years'].items():
        rows = main[year]
        ind = yd['indicators']
        for label, canon in REL_MAP.items():
            row = rows[label]
            e = ind[canon]
            common = dict(standard_specified=row['standard'], comparison_possible=row['comparable'],
                          standard_met=row['met'], reason_not_comparable=row['reason'],
                          unit_note=clean_doc(row['doc']))
            if canon in ('SAIDI', 'SAIFI', 'MAIFI'):
                v = parse_last(row['reported'])
                lab = re.match(r'(Annual \w+ \([^)]*\))', row['reported'])
                e.update(common, value=v, subtypes={'default': v}, benchmark='N/A', benchmark_meaning='N/A',
                         indicator_meaning=defs[year][canon].strip() if canon in defs[year] else e['indicator_meaning'],
                         reported_meaning=lab.group(1) if (v is not None and lab) else 'N/A')
            elif canon == 'VOLTAGE VARIATION':
                ht, lt = parse_voltage(row['reported'])
                note = None
                if 'unit not established' in (row['annualised'] or ''):
                    note = 'Unit not established in the source.'
                    if ht is not None and ht != int(ht):
                        note += f' Listed as a count of cases, but {ht:g} is not a whole number.'
                    if lt is not None:
                        note += f' HT value shown; the source also reports an LT value of {lt:g}.'
                e.update(common, value=ht, subtypes={'default': ht}, benchmark='N/A', benchmark_meaning='N/A',
                         reported_meaning='Number of cases (HT, FY, annual reporting)' if ht is not None else 'N/A',
                         unit_note=note or common['unit_note'])
            else:  # TRANSFORMER FAILURE: Urban + Rural, each inheriting the row's verdict
                sh = parse_shares(row['reported'])
                bm = benchmark(row['standard'])
                recs = {}
                for i, area in enumerate(('Urban', 'Rural')):
                    r = e['subtype_records'][area]
                    r.update(common, value=sh[i] if sh else None, benchmark=bm if bm is not None else 'N/A')
                    recs[area] = r
                comb = combined_share(row['annualised'])
                e.update(common, value=comb, subtypes={a: recs[a]['value'] for a in recs},
                         benchmark=bm if bm is not None else 'N/A', subtype_records=recs)
        yd['scoring'] = score_year(ind)


def patch_sop(t, main):
    for year, yd in t['years'].items():
        rows = main[year]
        by_name = {i['indicator']: i for i in yd['indicators']}
        for label, targets in SOP_MAP.items():
            row = rows[label]
            sh = parse_shares(row['reported'])
            for name, area in targets:
                i = by_name[name]
                v = (sh[0 if area == 'Urban' else 1] if sh else None) if area else parse_last(row['reported'])
                i.update(standard_specified=row['standard'], benchmark=benchmark(row['standard']), reported=v,
                         comparison_possible=row['comparable'], standard_met=row['met'],
                         reason_not_comparable=row['reason'])


def dump(path, obj):
    raw = open(path, encoding='utf-8', newline='').read()
    nl = '\r\n' if '\r\n' in raw else '\n'
    open(path, 'w', encoding='utf-8', newline='').write(json.dumps(obj, indent=2, ensure_ascii=False).replace('\n', nl))


def main():
    mn, defs = load_main()
    d = json.load(open(DISCOMS_JSON, encoding='utf-8'))
    patch_reliability(next(x for x in d['discoms'] if x['short_name'] == SHORT), mn, defs)
    dump(DISCOMS_JSON, d)
    s = json.load(open(SOP_JSON, encoding='utf-8'))
    patch_sop(next(x for x in s['discoms'] if x['short_name'] == SHORT), mn)
    dump(SOP_JSON, s)
    print('TPWODL patched in', DISCOMS_JSON, 'and', SOP_JSON)


if __name__ == '__main__':
    main()
