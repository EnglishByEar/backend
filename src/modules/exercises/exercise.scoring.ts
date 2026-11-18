/**
 * Dictation scoring: compares what the learner typed with the transcript,
 * word by word, ignoring case and punctuation.
 */

export function normalizeToWords(input: string): string[] {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

/** Levenshtein distance over words: insertions, deletions and substitutions each cost 1. */
export function wordEditDistance(a: string[], b: string[]): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];

    for (let j = 1; j <= b.length; j++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;

      current[j] = Math.min(
        previous[j]! + 1, // deletion
        current[j - 1]! + 1, // insertion
        previous[j - 1]! + substitutionCost // substitution / match
      );
    }

    previous = current;
  }

  return previous[b.length]!;
}

export interface DictationScore {
  accuracy: number;
  mistakes: number;
  totalWords: number;
}

export function scoreDictation(
  reference: string,
  answer: string
): DictationScore {
  const referenceWords = normalizeToWords(reference);
  const answerWords = normalizeToWords(answer);

  const mistakes = wordEditDistance(referenceWords, answerWords);
  const totalWords = referenceWords.length;

  const accuracy =
    totalWords === 0
      ? 0
      : Math.max(0, Math.round((1 - mistakes / totalWords) * 100));

  return { accuracy, mistakes, totalWords };
}
