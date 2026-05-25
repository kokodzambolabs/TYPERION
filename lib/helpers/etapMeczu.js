// Helpers dla fazy pucharowej MŚ 2026
// Zero zależności - czyste funkcje.

const ETAPY_PUCHAROWE = ['R32', 'R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL'];

export function czyPucharowy(groupName) {
  return ETAPY_PUCHAROWE.includes(groupName);
}

export function etykietaEtapu(groupName) {
  if (!groupName) return '';
  const v = String(groupName).toUpperCase();

  // Faza pucharowa
  if (v === 'R32') return '1/16 finału';
  if (v === 'R16') return '1/8 finału';
  if (v === 'QF') return 'Ćwierćfinał';
  if (v === 'SF') return 'Półfinał';
  if (v === 'THIRD_PLACE') return 'Mecz o 3. miejsce';
  if (v === 'FINAL') return 'Finał';

  // Faza grupowa
  if (v.startsWith('GROUP_')) {
    const litera = v.slice('GROUP_'.length);
    return litera ? `Grupa ${litera}` : '';
  }

  return '';
}
