/**
 * Spintax parser — syntax: [[option1|option2|option3]]
 * Variables like {nome}, {empresa} are NOT affected.
 * Process order: substitute variables FIRST, then parse spintax.
 */
export function parseSpintax(text: string): string {
  return text.replace(/\[\[([^\[\]]+)\]\]/g, (_, inner) => {
    const options = inner.split('|');
    return options[Math.floor(Math.random() * options.length)];
  });
}

export function hasSpintax(text: string): boolean {
  return /\[\[.*\|.*\]\]/.test(text);
}
