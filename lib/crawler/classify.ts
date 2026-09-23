type Category = { name: string; title: string | null };

export default function classifyWebsite(title: string, description: string, categories: Category[]): string | null {
  const haystack = `${title} ${description}`.toLowerCase();
  let bestName: string | null = null;
  let bestScore = 0;
  categories.forEach((category) => {
    const terms = [category.name, category.title || '']
      .flatMap((value) => value.toLowerCase().split(/[^\p{L}\p{N}]+/u))
      .filter((term) => term.length >= 3);
    const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
    if (score > bestScore) {
      bestName = category.name;
      bestScore = score;
    }
  });
  return bestName;
}
