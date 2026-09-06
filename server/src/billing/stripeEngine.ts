/**
 * Stripe Per-Bed / Per-Census Metered Billing Engine
 * Shoreline Care OS v6.2
 *
 * Implements:
 * - Dynamic per-bed / per-census tiered pricing ($1.50 - $2.50 per bed/month)
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
  private static readonly BASE_RATE_PER_BED = 2.00 // $2.00 / bed / month
  private static readonly ENTERPRISE_VOLUME_DISCOUNT_THRESHOLD = 150 // beds

  /**
   * Calculates monthly SaaS subscription based on facility scale.
   */
  static calculateMonthlyFee(licensedBeds: number, activeCensus?: number): PricingTierCalculation {
    const beds = Math.max(1, licensedBeds)
    let rate = StripeBillingEngine.BASE_RATE_PER_BED
    let tier: PricingTierCalculation['tier'] = 'PRO_TIER'

    if (beds >= StripeBillingEngine.ENTERPRISE_VOLUME_DISCOUNT_THRESHOLD) {
      rate = 1.65 // Volume discounted enterprise rate
      tier = 'ENTERPRISE_TIER'
    } else if (beds <= 25) {
      rate = 2.50 // Small home tier
    }

    const monthlyTotal = Math.round(beds * rate * 100) / 100

    return {
      licensedBeds: beds,
      activeCensus: activeCensus || beds,
      ratePerBedMonth: rate,
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
        notificationDispatched: true, // Dispatch email to Executive Director & Finance Admin
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