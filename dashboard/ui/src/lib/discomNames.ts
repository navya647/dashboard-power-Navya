/** Full names for the DISCOMs whose master-sheet `discom_name` is only the code (from
 * discoms2.json's full names; Odisha written "TP …" like the sheet's TPCODL). Only used where
 * the sheet gives no name of its own. */
const FULL_NAMES: Record<string, string> = {
  APCPDCL: 'Andhra Pradesh Central Power Distribution Corporation Limited',
  APEPDCL: 'Eastern Power Distribution Company of Andhra Pradesh Limited',
  APSPDCL: 'Southern Power Distribution Company of Andhra Pradesh Limited',
  APDCL: 'Assam Power Distribution Company Limited',
  BESCOM: 'Bangalore Electricity Supply Company Limited',
  GESCOM: 'Gulbarga Electricity Supply Company Limited',
  HESCOM: 'Hubli Electricity Supply Company Limited',
  MESCOM: 'Mangalore Electricity Supply Company Limited',
  PGVCL: 'Paschim Gujarat Vij Company Limited',
  KESCO: 'Kanpur Electricity Supply Company Limited',
  MVVNL: 'Madhyanchal Vidyut Vitaran Nigam Limited',
  MPCZ: 'Madhya Pradesh Madhya Kshetra Vidyut Vitaran Company Limited',
  MPWZ: 'Madhya Pradesh Paschim Kshetra Vidyut Vitaran Company Limited',
  MSEDCL: 'Maharashtra State Electricity Distribution Company Limited',
  TGNPDCL: 'Northern Power Distribution Company of Telangana Limited',
  TGSPDCL: 'Southern Power Distribution Company of Telangana Limited',
  TPNODL: 'TP Northern Odisha Distribution Limited',
  TPSODL: 'TP Southern Odisha Distribution Limited',
  TPWODL: 'TP Western Odisha Distribution Limited',
  WBSEDCL: 'West Bengal State Electricity Distribution Company Limited',
};

/** Sheet names that are the code plus a bracketed note rather than a full name. */
const OVERRIDES: Record<string, string> = {
  MPEZ: 'Madhya Pradesh Poorv Kshetra Vidyut Vitaran Company Limited',
  TNPDCL: 'Tamil Nadu Power Distribution Corporation Limited',
};

/** The sheet's own name without its trailing "(CODE)" when it gives one, else the full name
 * above, else the code. */
export function discomFullName(code: string, sheetName: string): string {
  if (OVERRIDES[code]) return OVERRIDES[code];
  if (sheetName !== code) return sheetName.replace(/\s*\([^)]*\)\s*$/, '');
  return FULL_NAMES[code] ?? code;
}
