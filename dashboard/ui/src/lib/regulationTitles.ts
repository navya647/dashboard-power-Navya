import type { RegulationDocument } from './types';

/** Each regulation document's full title, as the Common / State-specific indicator workbooks
 * (Dataset 1, Dataset 2) cite it, keyed by the document's row in data/hyperlinks.xlsx
 * (`state|title|year`). Display tidying only: the commission's name is shortened to its
 * abbreviation (the workbooks already do this for RERC and APERC), all-caps titles are set in
 * title case, and annotations such as "(upto 4th July 2024)" are dropped. Two corrections:
 * - Karnataka 2004: the workbooks drop the opening bracket ("…Commission Licensees' Standards…").
 * - Bihar 2017: the workbooks say "(First Amendment)", which duplicates the 2012 title; the links
 *   sheet and the document's own file name say it's the 2nd Amendment.
 * Documents the workbooks don't cite keep their links-sheet name (see `regulationTitle`). */
const TITLES: Record<string, string> = {
  'Maharashtra|Regulation|2021':
    'MERC (Electricity Supply Code and Standards of Performance of Distribution Licensees including Power Quality) Regulations, 2021',
  'Maharashtra|1st Amendment|2024':
    'MERC (Electricity Supply Code and Standards of Performance of Distribution Licensees including Power Quality) (First Amendment) Regulations, 2024',
  'Gujarat|Principal Regulation|2005': 'GERC (Standard of Performance of Distribution Licensee) Regulations, 2005',
  'Gujarat|Principal Regulation|2023': 'GERC (Standards of Performance of Distribution Licensees) Regulations, 2023',
  'Rajasthan|Principal Regulation|2021': 'RERC (Standards of Performance for Distribution Licensees) Regulations, 2021',
  'Madhya Pradesh|Principal Regulation|2004': 'MPERC (Distribution Performance Standards) Regulations, 2004',
  'Madhya Pradesh|Revision 2|2012': 'MPERC (Distribution Performance Standards) (Revision-II) Regulations, 2012 [No. RG-8(II) of 2012]',
  'Madhya Pradesh|First Amendment, Revision 2|2021':
    'MPERC (Distribution Performance Standards) (Revision-II) (First Amendment) Regulations, 2012 {ARG-8(II)(i) of 2021}',
  'Odisha|Principal Regulation|2004': "OERC (Licensees' Standards of Performance) Regulations, 2004",
  'Odisha|1st Amendment|2010': "OERC (Licensee's Standard of Performance) (1st Amendment) Regulations, 2010",
  'Telangana|Principal Regulation|2016': "TSERC (Licensees' Standards of Performance) Regulation, 2016",
  'Karnataka|Regulation|2004': "KERC (Licensees' Standards of Performance) Regulations, 2004",
  'Karnataka|Regulation|2022':
    'KERC (Rights of Consumers Relating to Supply of Electricity, Standards of Performance (SoP) and allied matters) Regulations, 2022',
  'Tamil Nadu|Regulation as amended up to 31-03-2024|2024':
    'Tamil Nadu Electricity Distribution Standards of Performance Regulations, 2004 (as amended up to 31-03-2024)',
  'Bihar|Principal Regulation|2006': 'BERC (Standards of Performance of Distribution Licensee) Regulations, 2006',
  'Bihar|1st Amendment|2012': 'BERC (Standards of Performance of Distribution Licensee) (First Amendment) Regulations, 2012',
  'Bihar|2nd Amendment|2017': 'BERC (Standards of Performance of Distribution Licensee) (Second Amendment) Regulations, 2017',
  'West Bengal|Principal Regulation|2010': 'WBERC (Standards of Performance of Licensees Relating to Consumer Services) Regulations, 2010',
  'West Bengal|1st Amendment|2013':
    'WBERC (Standards of Performance of Licensees Relating to Consumer Services) (First Amendment) Regulations, 2013',
  'Uttar Pradesh|Principal Regulation|2019': 'UPERC (Standards of Performance) Regulations, 2019',
  'Andhra Pradesh|Principal Regulation|': "APERC (Licensees' Standards of Performance) Regulation, 2004",
  'Andhra Pradesh|Amendment|2023': "APERC (Licensees' Standards of Performance) Fourth Amendment Regulation, 2023",
  'Andhra Pradesh|Amendment|2024': "Fifth Amendment to APERC (Licensees' Standards of Performance) Regulation, 2024",
  'Andhra Pradesh|Amendment|2025': "Sixth Amendment to APERC (Licensees' Standards of Performance) Regulation, 2025",
};

/** A document's display title: its full cited title, else its links-sheet name with the year. */
export function regulationTitle(state: string, doc: RegulationDocument): string {
  return TITLES[`${state}|${doc.title}|${doc.year ?? ''}`] ?? (doc.year ? `${doc.title}, ${doc.year}` : doc.title);
}
