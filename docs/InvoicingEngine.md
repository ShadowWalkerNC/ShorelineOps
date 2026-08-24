# Three-Way Invoice Matching Engine

The `ThreeWayInvoiceMatchingEngine` (`server/src/engine/invoicing.ts`) compares:
1. **Purchase Order**: Authorized contract price and expected quantity.
2. **Receiving Log**: Actual units received and inspected at the loading dock.
3. **Vendor Invoice**: Billed unit price and billed quantity.

## Variance Detection & Credit Memo Generation
- If `billedPrice > poPrice`: Generates a `PRICE_OVERCHARGE` dispute.
- If `billedQty > receivedQty`: Generates a `QUANTITY_SHORT` dispute.
- Automatically outputs a printable credit memo for vendor deduction before payment approval.
