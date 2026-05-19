const book: Record<string, string> = {
  "": "e4",
  e4: "e5",
  "e4 e5": "Nf3",
  "e4 e5 Nf3": "Nc6",
  d4: "d5",
  "d4 d5": "c4",
  "d4 Nf6": "c4",
  "e4 c5": "Nf3",
  "e4 c5 Nf3": "d6",
  "e4 e6": "d4",
  "e4 c6": "d4",
};

export const getBookMove = (moves: string[]) => {
  const key = moves.join(" ").trim();
  return book[key] ?? null;
};
