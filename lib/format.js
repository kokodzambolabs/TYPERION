// Helpery do dat w polskiej strefie czasowej (Europe/Warsaw, CET/CEST).
// User w formularzach wpisuje czas lokalny PL, my zapisujemy poprawnie do
// timestamptz w UTC. Konwersja używa Intl.DateTimeFormat (działa zarówno
// na serwerze, jak i w przeglądarce, niezależnie od strefy systemowej).

const STREFA = 'Europe/Warsaw';

// "YYYY-MM-DDTHH:MM" interpretowane jako czas lokalny PL → Date (UTC instant).
export function strefaPolskaDoDate(local) {
  if (!local) return null;
  const [datePart, timePart] = local.split('T');
  if (!datePart || !timePart) return null;
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  if ([y, m, d, hh, mm].some((v) => Number.isNaN(v))) return null;

  // Trick: traktujemy local jako UTC, sprawdzamy co Warszawa pokazuje
  // o tej godzinie UTC, różnica daje nam offset Warsaw - UTC, korygujemy.
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: STREFA,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(new Date(guess));
  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const hourGuess = obj.hour === '24' ? 0 : Number(obj.hour);
  const warsawAsUtc = Date.UTC(
    Number(obj.year), Number(obj.month) - 1, Number(obj.day),
    hourGuess, Number(obj.minute)
  );
  const offset = warsawAsUtc - guess;
  return new Date(guess - offset);
}

// Łączy datę "YYYY-MM-DD" i czas "HH:MM" w Date (z PL strefy).
export function polaczDateCzasPL(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  return strefaPolskaDoDate(`${dateStr}T${timeStr}`);
}

// Date / ISO string → "YYYY-MM-DDTHH:MM" w strefie Europe/Warsaw (do datetime-local).
export function dateDoStrefyPolska(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: STREFA,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const hh = obj.hour === '24' ? '00' : obj.hour;
  return `${obj.year}-${obj.month}-${obj.day}T${hh}:${obj.minute}`;
}

// Date / ISO → "YYYY-MM-DD" (date input, w strefie PL).
export function dateDoYmdPL(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: STREFA,
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = fmt.formatToParts(date);
  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${obj.year}-${obj.month}-${obj.day}`;
}

// Date / ISO → "HH:MM" (time input, w strefie PL).
export function dateDoHmPL(d) {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: STREFA,
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const obj = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const hh = obj.hour === '24' ? '00' : obj.hour;
  return `${hh}:${obj.minute}`;
}

// Polski display: "11 czerwca 2026, 18:00" w strefie PL.
export function formatujDatePL(d) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: STREFA,
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}

// Krótki polski display: "11.06.2026, 18:00" w strefie PL.
export function formatujDateKrotkoPL(d) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: STREFA,
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}

// Czytelne etykiety typu promptu AI (kolumna profiles.ai_prompt_type).
export function formatPromptType(type) {
  switch (type) {
    case 'deep_research':
      return 'Deep research';
    case 'deep_research_thinking':
      return 'Deep research + thinking 🧠';
    case 'quick':
      return 'Quick';
    case 'casual':
      return 'Casual (dominanta x100)';
    default:
      return type || '—';
  }
}

// Football-Data.org zwraca pole `group` (np. "GROUP_A") w fazie grupowej
// i `stage` (np. "ROUND_OF_16") w fazie pucharowej. Zapisujemy obie te
// wartości w jednej kolumnie matches.group_name - tu robimy ładne
// po-polsku display: "Grupa A", "1/8 finału", "Półfinał" itd.
//
// Dla nieznanych wartości zwracamy null - karta meczu chowa wtedy badge.
export function formatGrupa(raw) {
  if (!raw) return null;
  const v = String(raw).toUpperCase();

  if (v.startsWith('GROUP_')) {
    const litera = v.slice('GROUP_'.length);
    if (!litera) return null;
    return `Grupa ${litera}`;
  }

  switch (v) {
    case 'PRELIMINARY_ROUND':
      return 'Eliminacje';
    case 'PLAYOFFS':
    case 'PLAY_OFF_ROUND':
      return 'Play-off';
    case 'R32':
      return '1/16 finału';
    case 'LAST_16':
    case 'ROUND_OF_16':
    case 'R16':
      return '1/8 finału';
    case 'QF':
    case 'QUARTER_FINAL':
    case 'QUARTER_FINALS':
      return 'Ćwierćfinał';
    case 'SF':
    case 'SEMI_FINAL':
    case 'SEMI_FINALS':
      return 'Półfinał';
    case 'THIRD_PLACE':
    case 'THIRD_PLACE_FINAL':
      return 'Mecz o 3. miejsce';
    case 'FINAL':
      return 'Finał';
    case 'GROUP_STAGE':
      return 'Faza grupowa';
    case 'LEAGUE_STAGE':
      return 'Faza ligowa';
    case 'REGULAR_SEASON':
      return null;
    default:
      return null;
  }
}
