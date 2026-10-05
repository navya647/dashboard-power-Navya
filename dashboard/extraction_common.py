"""Extract data/Common Indicators.xlsx (35 DISCOMs, ~12 states, 5 FYs each) into data/discoms2.json.

Unlike the old workbook (extraction3.py), every sheet shares one column layout, but each
sheet has a repeated block per financial year (its own 'Year' header row + data rows).
This walks each sheet generically, splitting on those header rows, and normalizes the
~20 raw indicator-name variants across states into 8 canonical indicators.
"""
import json, re
import openpyxl

wb = openpyxl.load_workbook('data/Common Indicators.xlsx', data_only=True)

STATE_MAP = {
    'MAHARASHTRA': 'Maharashtra', 'GUJARAT': 'Gujarat', 'RAJASTHAN': 'Rajasthan',
    'RAJ': 'Rajasthan', 'ODISHA': 'Odisha', 'TELANGANA': 'Telangana',
    'MADHYA PRADESH': 'Madhya Pradesh', 'KARNATAKA': 'Karnataka', 'TAMIL NADU': 'Tamil Nadu',
    'BIHAR': 'Bihar', 'WEST BENGAL': 'West Bengal', 'UP': 'Uttar Pradesh', 'AP': 'Andhra Pradesh',
}

STATE_ORDER = ['Maharashtra', 'Gujarat', 'Rajasthan', 'Madhya Pradesh', 'Odisha', 'Telangana',
               'Karnataka', 'Tamil Nadu', 'Bihar', 'West Bengal', 'Uttar Pradesh', 'Andhra Pradesh']

# Sheets with an obviously non-standard short code (everything else is derived from the
# part of the sheet name before the comma).
SHORT_OVERRIDES = {
    'JdVVNL,RAJ': 'JdVVNL',
}

# Uttar Pradesh's 5 sheets have a blank cell where every other sheet in the workbook carries the
# licensee's full legal name (row 1, col A) — confirmed against the source file, not a parsing
# gap. Filled in from UPPCL's own site (https://www.uppcl.org/uppcl/en/article/discoms) since the
# workbook itself has nothing to extract here.
FULL_NAME_OVERRIDES = {
    'PVVNL, UP': 'Pashchimanchal Vidyut Vitaran Nigam Limited',
    'MVVNL,UP': 'Madhyanchal Vidyut Vitaran Nigam Limited',
    'DVVNL,UP': 'Dakshinanchal Vidyut Vitaran Nigam Limited',
    'PuVVNL,UP': 'Purvanchal Vidyut Vitaran Nigam Limited',
    'KESCO,UP': 'Kanpur Electricity Supply Company Limited',
}

# Figures whose number is in a different unit from the meaning text beside it, rescaled to that
# text's unit: (sheet, year, raw indicator) -> (factor, note shown on the dashboard). Only for
# cases with documentary evidence.
#   JdVVNL FY24 SAIDI: the Sep 2026 workbook gave 3.18 as "Total hours of supply interruption...";
#   the Oct 2026 revision relabelled the row "Total minutes..." to match the other years but kept
#   3.18, so it is 3.18 h = 190.8 min.
UNIT_CORRECTIONS = {
    ('JdVVNL,RAJ', '2023-24', 'SAIDI'): (
        60, 'Converted to minutes: the source figure {raw} was in hours (labelled "Total hours..." '
            'in the previous version of the workbook).'),
}

EXCLUDE_SHEETS ={'color scheme', 'verification', 'Calculations for MSEDCL'}

YEAR_RE = re.compile(r'^\d{4}-\d{2,4}$')

# ---- indicator normalization -------------------------------------------------------
CANONICAL = {
    'SAIDI': {'group': 'Reliability', 'unit': 'hours'},
    'SAIFI': {'group': 'Reliability', 'unit': 'count'},
    'MAIFI': {'group': 'Reliability', 'unit': 'count'},
    'CAIDI': {'group': 'Reliability', 'unit': 'hours'},
    'VOLTAGE VARIATION': {'group': 'Power Quality', 'unit': 'pct'},
    'HARMONICS': {'group': 'Power Quality', 'unit': 'pct'},
    'TRANSFORMER FAILURE': {'group': 'Service', 'unit': 'pct'},
    'BILLING COMPLAINT RESOLUTION': {'group': 'Consumer', 'unit': 'pct'},
}
CANONICAL_ORDER = list(CANONICAL.keys())


def normalize_indicator(raw):
    """('TRANSFORMER FAILURE', None|'Urban'|'Rural') from any raw indicator label."""
    if not raw:
        return None, None
    u = re.sub(r'\s+', ' ', raw.strip().upper())
    subtype = None
    if 'URBAN' in u:
        subtype = 'Urban'
    elif 'RURAL' in u:
        subtype = 'Rural'
    if 'SAIDI' in u:
        return 'SAIDI', subtype
    if 'SAIFI' in u:
        return 'SAIFI', subtype
    if 'MAIFI' in u:
        return 'MAIFI', subtype
    if 'CAIDI HT' in u:
        return None, None
    if 'CAIDI' in u:
        return 'CAIDI', subtype
    if 'VOLTAGE VARIATION' in u:
        return 'VOLTAGE VARIATION', subtype
    if 'HARMONICS' in u:
        return 'HARMONICS', subtype
    if 'TRANSFORMER FAILURE' in u or 'DT FAILURE' in u:
        return 'TRANSFORMER FAILURE', subtype
    if 'BILLING' in u:
        return 'BILLING COMPLAINT RESOLUTION', subtype
    return None, None


def sheet_values(ws):
    """Row tuples of cell values, with percent-formatted numbers rescaled to percentage points.

    A cell Excel displays as '96.19%' stores 0.9619. Every other percentage in the workbook is
    typed as 96.19 in a General cell, so the stored fraction is rescaled to match what the sheet
    actually shows (e.g. AVVNL FY25, UGVCL FY24)."""
    out = []
    for row in ws.iter_rows():
        out.append(tuple(
            round(c.value * 100, 6)
            if isinstance(c.value, (int, float)) and not isinstance(c.value, bool) and '%' in (c.number_format or '')
            else c.value
            for c in row
        ))
    return out


def clean(v):
    if v is None:
        return None
    if isinstance(v, str):
        v = v.strip()
        return v if v else None
    return v


def is_na(x):
    return x is None or str(x).strip().upper() in ('N/A', 'NA', '')


def to_bool_yn(x):
    if x is None:
        return None
    s = str(x).strip().upper()
    if s == 'YES':
        return True
    if s == 'NO':
        return False
    return None


def normalize_value(canon_key, raw_val, meaning):
    """Return (numeric_value, unit_note) for a canonical indicator's raw reported value.

    Values stay in the unit the sheet reports them in (minutes or hours, per `reported_meaning`):
    the UI labels each figure from that meaning text (ui/src/lib/indicatorUnits.ts), so converting
    minutes to hours here showed e.g. 608.4 minutes as "10.14 minutes"."""
    if raw_val is None or isinstance(raw_val, str):
        return None
    val = float(raw_val)
    if canon_key in ('SAIDI', 'CAIDI', 'SAIFI', 'MAIFI'):
        return round(val, 3)
    # percentage indicators
    return round(val, 2)


def _norm_meaning(m):
    return re.sub(r'\s+', ' ', (m or '').strip()).rstrip('.').strip().lower()


def _num(v):
    return f'{v:,.2f}'.rstrip('0').rstrip('.')


# Reporting bases that differ from the rest of their series only by period, restated onto the
# annual basis the other years use (methods signed off by the user, Oct 2026). Keyed by the
# normalized `reported_meaning`; each value: (factor, annual meaning text, note template).
PERIOD_STANDARDISATION = {
    # AVVNL SAIDI FY23–24: annual total = 4 quarters × the per-quarter average, in minutes.
    'average hours of supply interruption for an average consumer per quarter': (
        240, 'Total minutes of supply interruption for an average consumer over the year.',
        'Converted to minutes per year: reported as {raw} average hours per quarter (× 4 quarters × 60 minutes).'),
    # AVVNL SAIFI FY23–24: annual total = 4 quarters × the per-quarter average.
    'average number of sustained interruptions for an average consumer per quarter': (
        4, 'Total number of sustained interruptions for an average consumer over the year.',
        'Converted to interruptions per year: reported as {raw} average interruptions per quarter (× 4 quarters).'),
}

# MSEDCL FY25: the Calculations for MSEDCL sheet computes every year as Σ(quarterly figure) ÷
# Σ(quarterly consumers) over the quarters available, so a two-quarter year is on the same
# per-consumer basis as the others — kept as is, with its coverage noted (signed off, Oct 2026).
TWO_QUARTER_NOTE = ('Based on two quarters of data only. Computed the same way as the other years '
                    '(an average across the quarters available), so not scaled up.')


# Figures that can't be restated onto their series' basis (the source changes what is measured, not
# just its unit) — left as reported, with the reason shown beside them on the dashboard.
VALUE_NOTES = {
    ('TPWODL,ODISHA', '2022-23', 'Voltage Variation'):
        'Unit unclear in the source: listed as a count of HT cases, but 1.5 is not a whole number of cases.',
    ('TPWODL,ODISHA', '2024-25', 'Voltage Variation'):
        'A percentage of EHT and LT cases, not a case count like FY23–FY24 (HT only); the two cannot be converted.',
}


def standardise(sheet_name, year, raw_indicator, raw, meaning):
    """(raw, meaning, unit_note) with a figure restated onto its series' common basis, if needed."""
    if not isinstance(raw, (int, float)):
        return raw, meaning, None
    if (sheet_name, year, raw_indicator) in VALUE_NOTES:
        return raw, meaning, VALUE_NOTES[(sheet_name, year, raw_indicator)]
    factor = UNIT_CORRECTIONS.get((sheet_name, year, raw_indicator))
    if factor:
        f, note = factor
        return round(raw * f, 6), meaning, note.format(raw=_num(raw))
    nm = _norm_meaning(meaning)
    if nm in PERIOD_STANDARDISATION:
        f, new_meaning, note = PERIOD_STANDARDISATION[nm]
        return round(raw * f, 6), new_meaning, note.format(raw=_num(raw))
    if 'over two quarters' in nm:
        annual = re.sub(r'\s+over two quarters', ' over the year', re.sub(r'\s+', ' ', meaning.strip()))
        return raw, annual, TWO_QUARTER_NOTE
    return raw, meaning, None


def parse_sheet(sheet_name, ws):
    rows = sheet_values(ws)
    full_name = clean(rows[0][0]) or FULL_NAME_OVERRIDES.get(sheet_name)
    code, _, state_part = sheet_name.partition(',')
    code = code.strip()
    state = STATE_MAP.get(state_part.strip().upper(), state_part.strip() or 'Unknown')
    short_name = SHORT_OVERRIDES.get(sheet_name, code)

    blocks = {}  # year -> {'regulation': str, 'indicators': [...]}
    cur_reg = []
    i = 1
    n = len(rows)
    while i < n:
        r = rows[i]
        if r is None or all(c is None for c in r):
            i += 1
            continue
        c0 = clean(r[0])
        if c0 == 'Year':
            j = i + 1
            data = []
            while j < n:
                rj = rows[j]
                if rj is None or all(c is None for c in rj):
                    j += 1
                    continue
                c0j = clean(rj[0])
                if c0j == 'Year':
                    break
                if c0j and YEAR_RE.match(str(c0j)):
                    data.append(rj)
                    j += 1
                else:
                    break
            if data:
                year = clean(data[0][0])
                entries = []
                for rj in data:
                    raw_indicator = clean(rj[2])
                    canon, subtype = normalize_indicator(raw_indicator)
                    reported_raw = rj[7]
                    reported_meaning = clean(rj[8])
                    reported_raw, reported_meaning, unit_note = standardise(
                        sheet_name, clean(rj[0]), raw_indicator, reported_raw, reported_meaning)
                    value = normalize_value(canon, reported_raw, reported_meaning) if canon else None
                    entries.append({
                        'raw_indicator': raw_indicator,
                        'canonical': canon,
                        'subtype': subtype,
                        'indicator_type': clean(rj[1]),
                        'indicator_meaning': clean(rj[3]),
                        'standard_specified': clean(rj[4]),
                        'benchmark': clean(rj[5]),
                        'benchmark_meaning': clean(rj[6]),
                        'reported_raw': clean(reported_raw),
                        'reported_meaning': reported_meaning,
                        'value': value,
                        'unit_note': unit_note,
                        'comparison_possible': to_bool_yn(rj[9]),
                        'standard_met': to_bool_yn(rj[10]),
                        'reason_not_comparable': clean(rj[11]) if len(rj) > 11 else None,
                    })
                blocks[year] = {'regulation': ' | '.join(cur_reg), 'indicators': entries}
                cur_reg = []
            i = j
        else:
            cur_reg.append(str(c0))
            i += 1

    return {
        'sheet': sheet_name,
        'full_name': full_name,
        'short_name': short_name,
        'state': state,
        'years': blocks,
    }


def collapse_canonical(entries):
    """Average Urban/Rural (and any duplicate) rows of the same canonical indicator
    into one value per canonical indicator, keeping the richest metadata available."""
    by_canon = {}
    for e in entries:
        if not e['canonical']:
            continue
        by_canon.setdefault(e['canonical'], []).append(e)
    out = {}
    for canon, es in by_canon.items():
        vals = [e['value'] for e in es if e['value'] is not None]
        rep = max(es, key=lambda e: 0 if e['value'] is None else 1)
        out[canon] = {
            'value': round(sum(vals) / len(vals), 3) if vals else None,
            'subtypes': {e['subtype'] or 'default': e['value'] for e in es},
            'indicator_meaning': rep['indicator_meaning'],
            'standard_specified': rep['standard_specified'],
            'benchmark': rep['benchmark'],
            'benchmark_meaning': rep['benchmark_meaning'],
            'reported_meaning': rep['reported_meaning'],
            'unit_note': rep['unit_note'],
            'comparison_possible': any(e['comparison_possible'] for e in es if e['comparison_possible'] is not None) if any(e['comparison_possible'] is not None for e in es) else None,
            'standard_met': all(e['standard_met'] for e in es if e['standard_met'] is not None) if any(e['standard_met'] is not None for e in es) else None,
            'reason_not_comparable': rep['reason_not_comparable'],
        }
    return out


def score_year(canon_map):
    n = len(CANONICAL_ORDER)
    present = [canon_map.get(k) for k in CANONICAL_ORDER]
    has_standard = sum(1 for c in present if c and not is_na(c['standard_specified']))
    reported = sum(1 for c in present if c and c['value'] is not None)
    claimed_comparable = [c for c in present if c and c['comparison_possible']]
    comparable_inds = [c for c in claimed_comparable if c['value'] is not None]
    comparable = len(comparable_inds)
    phantom = len(claimed_comparable) - comparable
    met = sum(1 for c in comparable_inds if c['standard_met'])
    composite = (
        (100 * has_standard / n) * 0.25 + (100 * reported / n) * 0.25 +
        (100 * comparable / n) * 0.30 +
        ((100 * met / len(comparable_inds)) if comparable_inds else 0) * 0.20
    )
    return {
        'total_indicators': n,
        'standards_available_pct': round(100 * has_standard / n, 1),
        'data_reported_pct': round(100 * reported / n, 1),
        'comparable_pct': round(100 * comparable / n, 1),
        'compliance_pct': round(100 * met / len(comparable_inds), 1) if comparable_inds else None,
        'composite_score': round(composite, 1),
        'grade': 'A' if composite >= 70 else ('B' if composite >= 45 else 'C'),
        'phantom_comparable_count': phantom,
        'indicators_reported': reported,
    }


discoms = []
for sheet_name in wb.sheetnames:
    if sheet_name in EXCLUDE_SHEETS:
        continue
    parsed = parse_sheet(sheet_name, wb[sheet_name])
    by_year = {}
    for year, block in parsed['years'].items():
        canon_map = collapse_canonical(block['indicators'])
        by_year[year] = {
            'regulation': block['regulation'],
            'indicators': canon_map,
            'scoring': score_year(canon_map),
        }
    # A reported figure whose meaning cell was left blank (e.g. DGVCL FY22 transformer failure)
    # takes the meaning its other years all agree on, so it is labelled with the same unit.
    for canon in CANONICAL_ORDER:
        stated = {_norm_meaning(y['indicators'][canon]['reported_meaning']): y['indicators'][canon]['reported_meaning']
                  for y in by_year.values()
                  if canon in y['indicators'] and y['indicators'][canon]['value'] is not None
                  and not is_na(y['indicators'][canon]['reported_meaning'])}
        if len(stated) != 1:
            continue
        for y in by_year.values():
            e = y['indicators'].get(canon)
            if e and e['value'] is not None and is_na(e['reported_meaning']):
                e['reported_meaning'] = next(iter(stated.values()))
                e['unit_note'] = "Unit not stated in the source for this year; taken from this DISCOM's other years."
    discoms.append({
        'sheet': parsed['sheet'],
        'full_name': parsed['full_name'],
        'short_name': parsed['short_name'],
        'state': parsed['state'],
        'years': by_year,
    })

all_years = sorted({y for d in discoms for y in d['years']}, reverse=True)

with open('data/discoms2.json', 'w', encoding='utf-8') as f:
    json.dump({
        'state_order': STATE_ORDER,
        'canonical_indicators': CANONICAL,
        'canonical_order': CANONICAL_ORDER,
        'years': all_years,
        'discoms': discoms,
    }, f, indent=2, ensure_ascii=False)

print(f'Extracted {len(discoms)} DISCOMs across {len({d["state"] for d in discoms})} states, years={all_years}')
for d in discoms:
    y0 = all_years[0]
    sc = d['years'].get(y0, {}).get('scoring')
    print(f"  {d['short_name']:10} ({d['state']:16}) {y0}: score={sc['composite_score'] if sc else 'n/a'}")
