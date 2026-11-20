export type Food = {
  id: number;
  food: string;
  local_name: string | null;
  dex_group: string;
  type: "Plant" | "Alternative" | "Staple" | "Animal";
  protein_g_per_100g: number;
  price_ngn_per_kg: number | null;
  /** What protein_g_per_100g is measured on: "Dry", "Raw", "Cooked", "As eaten"... (optional for older callers). */
  basis?: string | null;
};

/** What the AI scanner returns per item (validated). */
export type VisionItem = {
  food: string;
  local_name: string;
  portion: string;
  estimated_grams: number;
  cooking_method: string;
  confidence: number;
};

export type VisionResult = { dish_name: string; items: VisionItem[] };

/** A scanned item waiting for the user to confirm it. */
export type DraftItem = VisionItem & {
  matched_food_id: number | null; // what our matcher picked
};

export type ScanResponse = { dish_name: string; items: DraftItem[]; cached: boolean };
