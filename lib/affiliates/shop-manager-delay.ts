/** Inclusive random wait (seconds) before shop-manager portal actions proceed. */
export const SHOP_MANAGER_FAST_DELAY_SEC = 0;
export const SHOP_MANAGER_DELAY_MIN_SEC = 20;
export const SHOP_MANAGER_DELAY_MAX_SEC = 120;
/** Chance of the fast 0s path (rest use the long randomized range). */
export const SHOP_MANAGER_FAST_DELAY_CHANCE = 0.8;

/**
 * 80% of the time → 0 seconds.
 * 20% of the time → uniform random in [20, 120] seconds.
 */
export function randomShopManagerDelaySeconds(): number {
  if (Math.random() < SHOP_MANAGER_FAST_DELAY_CHANCE) {
    return SHOP_MANAGER_FAST_DELAY_SEC;
  }
  const span = SHOP_MANAGER_DELAY_MAX_SEC - SHOP_MANAGER_DELAY_MIN_SEC + 1;
  return SHOP_MANAGER_DELAY_MIN_SEC + Math.floor(Math.random() * span);
}
