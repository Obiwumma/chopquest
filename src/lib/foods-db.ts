import { query } from "./db";
import type { Food } from "./foods";

export async function listFoods(): Promise<Food[]> {
  return query<Food>(`
    SELECT id, food, local_name, dex_group, type, protein_g_per_100g, price_ngn_per_kg, basis
    FROM foods ORDER BY type, dex_group, food`);
}
