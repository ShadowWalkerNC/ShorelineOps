/**
 * Facility subscription pricing and Stripe event interpretation
 * Shoreline Care OS v6.2
 *
 * Implements:
 * - Monthly facility pricing aligned with the approved marketing plans
 * - Stripe webhook event processing (invoice.payment_succeeded, invoice.payment_failed)
 * - Non-intrusive clinical grace dunning: failed invoices trigger administrative warning banners
 *   without EVER locking kitchen staff out of resident meal service.
 */

export interface PricingTierCalculation {
  licensedBeds: number
  activeCensus: number
  ratePerBedMonth: number
  monthlyTotal: number
  tier: 'COMMUNITY' | 'PRO_TIER' | 'ENTERPRISE_TIER'
}

export interface DunningStatus {
  facilityId: string
  status: 'CURRENT' | 'PAST_DUE' | 'GRACE_PERIOD' | 'EXEMPT'
  failedInvoiceCount: number
  lastPaymentError?: string
  gracePeriodEndsAt?: string
  clinicalLockoutAllowed: false // Invariant: ALWAYS false
}

export class StripeBillingEngine {
  /**
   * Calculates the selected facility plan. Bed counts are descriptive only.
   */
  static calculateMonthlyFee(licensedBeds: number, activeCensus?: number, tier: PricingTierCalculation['tier'] = 'PRO_TIER'): PricingTierCalculation {
    const beds = Math.max(1, licensedBeds)
    const monthlyTotal = { COMMUNITY: 0, PRO_TIER: 199, ENTERPRISE_TIER: 399 }[tier]

    return {
      licensedBeds: beds,
      activeCensus: activeCensus ?? beds,
      ratePerBedMonth: 0, // Legacy response field. Facility plans have no per-bed charge.
      monthlyTotal,
      tier,
    }
  }

  /**
   * Processes inbound Stripe Webhook events.
   */
  static handleStripeWebhookEvent(event: { type: string; data: { object: any } }): {
    action: string
    facilityId: string
    dunningStatus: DunningStatus
    notificationDispatched: boolean
  } {
    const obj = event.data.object
    const facilityId = obj.metadata?.facilityId || 'FAC-DEFAULT'

    if (event.type === 'invoice.payment_succeeded') {
      return {
        action: 'PAYMENT_CONFIRMED',
        facilityId,
        dunningStatus: {
          facilityId,
          status: 'CURRENT',
          failedInvoiceCount: 0,
          clinicalLockoutAllowed: false,
        },
        notificationDispatched: false,
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const graceEnd = new Date()
      graceEnd.setDate(graceEnd.getDate() + 14) // 14-day administrative grace period

      return {
        action: 'DUNNING_WARNING_TRIGGERED',
        facilityId,
        dunningStatus: {
          facilityId,
          status: 'PAST_DUE',
          failedInvoiceCount: (obj.attempt_count || 1),
          lastPaymentError: obj.last_finalization_error?.message || 'Payment card declined',
          gracePeriodEndsAt: graceEnd.toISOString(),
          clinicalLockoutAllowed: false, // Invariant: Meal service is never halted
        },
        notificationDispatched: false, // No notification transport is configured here.
      }
    }

    return {
      action: 'IGNORED',
      facilityId,
      dunningStatus: {
        facilityId,
        status: 'CURRENT',
        failedInvoiceCount: 0,
        clinicalLockoutAllowed: false,
      },
      notificationDispatched: false,
    }
  }
}
