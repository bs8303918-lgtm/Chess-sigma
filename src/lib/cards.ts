import type { CardRarity, GachaCard } from "@/types/game";

const rarityWeights: Record<CardRarity, number> = {
  Common: 60,
  Rare: 25,
  Epic: 11,
  Legendary: 4,
};

export const cardsPool: GachaCard[] = [
  {
    id: "sigma-knight",
    name: "Sigma Knight",
    rarity: "Common",
    image_url:
      "https://images.unsplash.com/photo-1528819622765-d6bcf132f793?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "aura-bishop",
    name: "Aura Bishop",
    rarity: "Common",
    image_url:
      "https://images.unsplash.com/photo-1586165368502-1bad197a6461?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "risk-rook",
    name: "Risk Rook",
    rarity: "Rare",
    image_url:
      "https://images.unsplash.com/photo-1611195974226-a6a9be9dd763?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "skubidu-queen",
    name: "Skubidu Queen",
    rarity: "Epic",
    image_url:
      "https://images.unsplash.com/photo-1560179406-1c6c60e0dc76?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "giga-king",
    name: "GigaChad King",
    rarity: "Legendary",
    image_url:
      "https://images.unsplash.com/photo-1594752730019-5af2f2c4f808?auto=format&fit=crop&w=900&q=80",
  },
];

const chooseRarity = (): CardRarity => {
  const roll = Math.random() * 100;
  let cursor = 0;

  for (const [rarity, weight] of Object.entries(rarityWeights) as [
    CardRarity,
    number,
  ][]) {
    cursor += weight;
    if (roll <= cursor) return rarity;
  }

  return "Common";
};

export const rollGachaCard = (): GachaCard => {
  const rarity = chooseRarity();
  const cards = cardsPool.filter((card) => card.rarity === rarity);
  return cards[Math.floor(Math.random() * cards.length)];
};
