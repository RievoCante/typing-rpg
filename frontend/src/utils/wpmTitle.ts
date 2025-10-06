// Maps WPM to celebratory titles
export function getWpmTitle(wpm: number): string {
  if (wpm < 40) return 'cool';
  if (wpm < 60) return 'great';
  if (wpm < 80) return 'FAST';
  if (wpm < 100) return 'SUPER FAST';
  if (wpm < 120) return 'INSANELY FAST';
  return 'GODLIKE';
}
