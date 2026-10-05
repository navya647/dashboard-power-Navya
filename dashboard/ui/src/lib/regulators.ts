/** Each covered state's electricity regulatory commission (its SERC): short name, full name and
 * official website. Not from the workbooks — looked up and checked by hand (Oct 2026). Where the
 * accessibility workbook records the commission page a state's DISCOM data was found on
 * (`serc_link`), the card links that page instead of the homepage. */
export interface Regulator {
  abbr: string;
  name: string;
  url: string;
}

export const REGULATORS: Record<string, Regulator> = {
  Maharashtra: { abbr: 'MERC', name: 'Maharashtra Electricity Regulatory Commission', url: 'https://merc.gov.in/' },
  Gujarat: { abbr: 'GERC', name: 'Gujarat Electricity Regulatory Commission', url: 'https://www.gercin.org/' },
  Rajasthan: { abbr: 'RERC', name: 'Rajasthan Electricity Regulatory Commission', url: 'https://rerc.rajasthan.gov.in/' },
  'Madhya Pradesh': { abbr: 'MPERC', name: 'Madhya Pradesh Electricity Regulatory Commission', url: 'https://mperc.in/' },
  Odisha: { abbr: 'OERC', name: 'Odisha Electricity Regulatory Commission', url: 'https://www.orierc.org/' },
  Telangana: { abbr: 'TGERC', name: 'Telangana Electricity Regulatory Commission', url: 'https://www.tgerc.telangana.gov.in/' },
  Karnataka: { abbr: 'KERC', name: 'Karnataka Electricity Regulatory Commission', url: 'https://kerc.karnataka.gov.in/english' },
  'Tamil Nadu': { abbr: 'TNERC', name: 'Tamil Nadu Electricity Regulatory Commission', url: 'https://tnerc.tn.gov.in/' },
  Bihar: { abbr: 'BERC', name: 'Bihar Electricity Regulatory Commission', url: 'https://berc.co.in/' },
  'West Bengal': { abbr: 'WBERC', name: 'West Bengal Electricity Regulatory Commission', url: 'https://www.wberc.gov.in/' },
  'Uttar Pradesh': { abbr: 'UPERC', name: 'Uttar Pradesh Electricity Regulatory Commission', url: 'https://www.uperc.org/' },
  'Andhra Pradesh': { abbr: 'APERC', name: 'Andhra Pradesh Electricity Regulatory Commission', url: 'https://aperc.gov.in/' },
};
