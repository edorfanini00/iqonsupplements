/** Constructs a synthetic test fixture only; does not send or create any order. */
export function syntheticTrackingOrder(now = new Date(), orderId = 9000000000000001) {
  return {
    id: orderId,
    test: true,
    source_name: "web",
    processed_at: now.toISOString(),
    currency: "USD",
    total_price: "1.00",
    line_items: [{ variant_id: 8001, quantity: 1, price: "1.00" }],
    note_attributes: [
      { name: "_meta_consent", value: "granted-v1" },
      { name: "_meta_test_fixture", value: "synthetic-v1" },
    ],
  };
}
