"""Extract data/ACCESSIBILITY.xlsx into ui/public/data/accessibility.json for the Next.js app.

Unlike Common Indicators.xlsx (per-DISCOM sheets, 5 years of numeric indicators each), this
workbook is flat and year-less — two simple sheets:
  - REGULATION: one row per state, whether that state's SERC regulation is published online.
  - REPORTED DATAPERFORMANCE: one row per DISCOM, whether its reported performance data is
    published on the SERC website and whether that publication is machine-readable.
Written straight to ui/public/data/ (not data/, unlike discoms2.json) since there's no existing
build step that copies repo-root data/ output into ui/public/data/ — this way the app can fetch
it directly with nothing to remember to sync.
"""
import json, re
import openpyxl

wb = openpyxl.load_workbook('data/ACCESSIBILITY.xlsx', data_only=True)

# Same canonical state names/order as extraction_common.py's STATE_MAP/STATE_ORDER, so this
# dataset lines up with the rest of the app (map state names, discoms2.json's state_order).
STATE_MAP = {
    'MAHARASHTRA': 'Maharashtra', 'GUJARAT': 'Gujarat', 'RAJASTHAN': 'Rajasthan',
    'ODISHA': 'Odisha', 'TELANGANA': 'Telangana', 'MADHYA PRADESH': 'Madhya Pradesh',
    'KARNATAKA': 'Karnataka', 'TAMIL NADU': 'Tamil Nadu', 'BIHAR': 'Bihar',
    'WEST BENGAL': 'West Bengal', 'UTTAR PRADESH': 'Uttar Pradesh', 'ANDHRA PRADESH': 'Andhra Pradesh',
}
STATE_ORDER = ['Maharashtra', 'Gujarat', 'Rajasthan', 'Madhya Pradesh', 'Odisha', 'Telangana',
               'Karnataka', 'Tamil Nadu', 'Bihar', 'West Bengal', 'Uttar Pradesh', 'Andhra Pradesh']


def to_bool(v):
    """'Yes'/'No' -> True/False; anything else ('N/A', blank, None) -> None (not applicable)."""
    if v is None:
        return None
    s = str(v).strip().lower()
    if s == 'yes':
        return True
    if s == 'no':
        return False
    return None


def norm_state(s):
    return STATE_MAP.get(str(s).strip().upper(), str(s).strip())


def header_cols(ws):
    """{UPPERCASED header -> column index}. Columns are located by name, not position — the
    workbook's column order has changed between revisions (e.g. MACHINE READABLE? moved after
    the link column)."""
    return {str(c.value).strip().upper(): i for i, c in enumerate(ws[1]) if c.value is not None}


def link(cell):
    """URL of a link cell. The display text is a file/year listing (e.g. 'FY 2021-22 FY 2022-23
    ...'); the actual URL lives only in the cell's hyperlink. Falls back to the text when it is
    itself a URL (older revisions typed the URL straight into the cell)."""
    if cell.hyperlink and cell.hyperlink.target:
        return cell.hyperlink.target.strip()
    v = cell.value
    return str(v).strip() if isinstance(v, str) and v.strip().startswith('http') else None


# Abbreviation typos in this workbook, mapped to the code the other two workbooks use.
ABBREV_FIXES = {'MPWX': 'MPWZ', 'AVNNL': 'AVVNL'}

# One spelling of each licensee's legal name across the dashboard: the reliability workbook's
# (data/discoms2.json, so run extraction_common.py first). This sheet has variants ("Vitran" for
# "Vitaran", no "Limited") and one wrong name (PGVCL as "Poorva" instead of "Paschim" Gujarat).
with open('data/discoms2.json', encoding='utf-8') as f:
    CANONICAL_NAMES = {d['short_name']: d['full_name'] for d in json.load(f)['discoms']}


def label(cell):
    """The link cell's display text (the document file names), tidied: '.pdf' and runs of
    spaces/underscores collapsed. Only shown beside the link, never parsed for meaning."""
    v = cell.value
    if not isinstance(v, str) or not v.strip():
        return None
    t = re.sub(r'\.pdf', ' ', v, flags=re.I)
    t = re.sub(r'[_\s]+', ' ', t).strip()
    return t or None


def comment_url(cell):
    """The SERC web page a DISCOM's data was found on. The workbook records it as a cell comment
    on the AVAILABLE ON SERC WEBSITE? cell (the comment's text is just the URL)."""
    if cell.comment is None:
        return None
    m = re.search(r'https?://\S+', cell.comment.text or '')
    return m.group(0) if m else None


def cell_url(cell):
    """A URL typed into a cell, or failing that the cell's hyperlink target."""
    v = cell.value
    if isinstance(v, str) and v.strip().startswith('http'):
        return v.strip()
    if cell.hyperlink and cell.hyperlink.target:
        return cell.hyperlink.target.strip()
    return None


def year_text(v):
    """A Year cell as text ('2004'); None when blank. Numeric cells come back as int/float."""
    if v is None or str(v).strip() == '':
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


# ---------- data/hyperlinks.xlsx: one direct link per regulation document, and per DISCOM per
# financial year of reported data. The main workbook's link cells hold only one hyperlink each
# (a single file or a folder) even where the text lists several years, so the year-wise links
# live in this companion workbook. ----------
REG_DOCS = {}    # state -> [{title, year, url}] in sheet order
DATA_LINKS = {}  # (state, DISCOM abbreviation or None for a state-level folder) -> [{year, url, kind, scope}]
links_wb = openpyxl.load_workbook('data/hyperlinks.xlsx', data_only=True)

ws = links_wb['Regulations']
col = header_cols(ws)
for r in ws.iter_rows(min_row=2):
    state, url = r[col['STATE']].value, cell_url(r[col['DIRECT LINK']])
    if state is None or url is None:
        continue
    REG_DOCS.setdefault(norm_state(state), []).append({
        'title': str(r[col['REGULATION / AMENDMENT']].value).strip(),
        'year': year_text(r[col['YEAR']].value),
        'url': url,
    })

ws = links_wb['Reported Data']
col = header_cols(ws)
for r in ws.iter_rows(min_row=2):
    state, url = r[col['STATE']].value, cell_url(r[col['EXPLICIT YEAR LINK']])
    if state is None or url is None:  # 'No files found' rows carry no link
        continue
    who = str(r[col['DISCOM']].value or '').strip()
    state_level = who.lower() == 'state-level folder'
    fy = re.search(r'20\d\d-\d\d', str(r[col['FINANCIAL YEAR']].value or ''))
    if fy is None:
        continue
    link_type = str(r[col['LINK TYPE']].value or '').strip().lower()
    DATA_LINKS.setdefault((norm_state(state), None if state_level else ABBREV_FIXES.get(who, who)), []).append({
        'year': fy.group(0),
        'url': url,
        'kind': 'folder' if 'folder' in link_type else 'file',
        'scope': 'state' if state_level else 'discom',
    })


def data_links(state, abbrev):
    """A DISCOM's year-wise reported-data links: its own, or else its state's year folders (which
    cover every DISCOM in that state). Sorted by year."""
    links = DATA_LINKS.get((state, abbrev)) or DATA_LINKS.get((state, None)) or []
    return sorted(links, key=lambda l: l['year'])


# ---------- REGULATION: one row per state ----------
ws = wb['REGULATION']
col = header_cols(ws)
states = []
for r in ws.iter_rows(min_row=2):
    state = r[col['STATE']].value
    if state is None:
        continue
    states.append({
        'state': norm_state(state),
        'regulation_available': to_bool(r[col['AVAILABLE ON SERC WEBSITE?']].value),
        'regulation_link': link(r[col['REGULATION LINK']]) if 'REGULATION LINK' in col else None,
        'regulation_label': label(r[col['REGULATION LINK']]) if 'REGULATION LINK' in col else None,
        'amendment_link': link(r[col['AMENDMENT LINK']]) if 'AMENDMENT LINK' in col else None,
        'amendment_label': label(r[col['AMENDMENT LINK']]) if 'AMENDMENT LINK' in col else None,
        'regulation_documents': REG_DOCS.get(norm_state(state), []),
    })
states.sort(key=lambda s: STATE_ORDER.index(s['state']) if s['state'] in STATE_ORDER else 99)

# ---------- REPORTED DATAPERFORMANCE: one row per DISCOM ----------
ws = wb['REPORTED DATAPERFORMANCE']
col = header_cols(ws)
link_col = col.get('GOOGLE DRIVE LINK', col.get('DRIVE LINK'))
discoms = []
for r in ws.iter_rows(min_row=2):
    full_name = r[col['DISCOM']].value
    if full_name is None:
        continue
    abbrev = str(r[col['DISCOM ABBREVIATION']].value).strip()
    abbrev = ABBREV_FIXES.get(abbrev, abbrev)
    discoms.append({
        'discom': CANONICAL_NAMES.get(abbrev, str(full_name).strip()),
        'abbreviation': abbrev,
        'state': norm_state(r[col['STATE']].value),
        'available_on_serc': to_bool(r[col['AVAILABLE ON SERC WESBITE?']].value),
        'machine_readable': to_bool(r[col['MACHINE READABLE?']].value),
        'drive_link': link(r[link_col]) if link_col is not None else None,
        'serc_link': comment_url(r[col['AVAILABLE ON SERC WESBITE?']]),
        'data_links': data_links(norm_state(r[col['STATE']].value), abbrev),
    })
discoms.sort(key=lambda d: (STATE_ORDER.index(d['state']) if d['state'] in STATE_ORDER else 99, d['discom']))

summary = {
    'states_total': len(states),
    'states_regulation_available': sum(1 for s in states if s['regulation_available'] is True),
    'discoms_total': len(discoms),
    'discoms_available_on_serc': sum(1 for d in discoms if d['available_on_serc'] is True),
    'discoms_machine_readable': sum(1 for d in discoms if d['machine_readable'] is True),
}

out = {
    'state_order': STATE_ORDER,
    'states': states,
    'discoms': discoms,
    'summary': summary,
}

path = 'ui/public/data/accessibility.json'
with open(path, 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

print(f'Wrote {path}')
print(json.dumps(summary, indent=2))
