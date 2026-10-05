'use client';

import { fyLabel } from '@/lib/format';
import SingleSelect from './SingleSelect';

interface Props {
  /** financial years, ascending, in the JSON's raw "2023-24" form */
  years: string[];
  /** 'all' or one of `years` */
  value: string;
  onChange: (value: string) => void;
}

/** The filter bar's single-select Year control ("All years" or one FY). */
export default function YearSelect({ years, value, onChange }: Props) {
  const options = [{ value: 'all', label: 'All years' }, ...years.map((y) => ({ value: y, label: fyLabel(y) }))];
  return <SingleSelect name="Year" options={options} value={value} onChange={onChange} />;
}
