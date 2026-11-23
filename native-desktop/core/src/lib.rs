pub mod paper;

use std::collections::{BTreeMap, BTreeSet};

/// The source revisions identify the approved information printed on one ticket.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TicketRevision {
    pub menu: u64,
    pub diet_order: u64,
    pub choices: u64,
}

/// One exact production portion. Different recipe versions and textures never share a tally.
#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct PortionKey {
    pub recipe_version: String,
    pub portion_code: String,
    pub texture_code: String,
}

#[derive(Clone, Debug)]
pub struct PrintedTicket {
    pub id: String,
    pub revision: TicketRevision,
    pub choices: BTreeSet<PortionKey>,
}

/// The server must obtain the clinical result from its current, deterministic tray checker.
/// The reviewer identity comes from the authorized session, never from the paper or client.
#[derive(Clone, Debug)]
pub enum ReviewedDisposition {
    Verified(Vec<PortionKey>),
    Excluded(ExclusionReason),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ExclusionReason {
    NoOralService,
    NoMealRequired,
}

#[derive(Clone, Debug)]
pub struct ReviewedTicket {
    pub id: String,
    pub printed_revision: TicketRevision,
    pub reviewer_id: String,
    pub disposition: ReviewedDisposition,
}

#[derive(Debug, Eq, PartialEq)]
pub enum ReconciliationError {
    EmptyPacket,
    InvalidIdentifier,
    DuplicatePrintedTicket(String),
    UnknownTicket(String),
    TicketNotPrinted(String),
    DuplicateReview(String),
    MissingReview(String),
    StaleTicket(String),
    InvalidSelection(String),
    MissingReviewer(String),
    CountOverflow,
}

#[derive(Debug, Eq, PartialEq)]
pub struct ProductionTally {
    pub portions: BTreeMap<PortionKey, u32>,
    pub verified_meals: u32,
    pub excluded_tickets: u32,
}

#[derive(Debug, Eq, PartialEq)]
pub struct FoodCost {
    pub known_cents: u64,
    pub missing_portions: u32,
    pub verified_meals: u32,
}

impl FoodCost {
    /// Returns the cost per verified meal, rounded to the nearest cent.
    pub fn cost_per_verified_meal_cents(&self) -> Option<u64> {
        if self.missing_portions != 0 || self.verified_meals == 0 {
            return None;
        }
        let meals = u64::from(self.verified_meals);
        let round_up = self.known_cents % meals >= meals.div_ceil(2);
        Some(self.known_cents / meals + u64::from(round_up))
    }
}

/// Verify the entire packet before returning any count. The service must load
/// the full expected ticket roster for this service and persist the tally in one transaction.
pub fn reconcile(
    printed: &[PrintedTicket],
    current: &BTreeMap<String, TicketRevision>,
    reviewed: &[ReviewedTicket],
) -> Result<ProductionTally, ReconciliationError> {
    use ReconciliationError::*;

    if printed.is_empty() {
        return Err(EmptyPacket);
    }
    let mut tickets = BTreeMap::new();
    for ticket in printed {
        if ticket.id.trim().is_empty() {
            return Err(InvalidIdentifier);
        }
        if tickets.insert(ticket.id.as_str(), ticket).is_some() {
            return Err(DuplicatePrintedTicket(ticket.id.clone()));
        }
    }

    if let Some(id) = current.keys().find(|id| !tickets.contains_key(id.as_str())) {
        return Err(TicketNotPrinted(id.clone()));
    }

    let mut tally = ProductionTally {
        portions: BTreeMap::new(),
        verified_meals: 0,
        excluded_tickets: 0,
    };
    let mut seen = BTreeSet::new();
    for review in reviewed {
        let id = review.id.as_str();
        let ticket = tickets.get(id).ok_or_else(|| UnknownTicket(id.into()))?;
        if !seen.insert(id) {
            return Err(DuplicateReview(id.into()));
        }
        if review.reviewer_id.trim().is_empty() {
            return Err(MissingReviewer(id.into()));
        }
        if review.printed_revision != ticket.revision || current.get(id) != Some(&ticket.revision) {
            return Err(StaleTicket(id.into()));
        }

        match &review.disposition {
            ReviewedDisposition::Verified(portions) => {
                let distinct: BTreeSet<_> = portions.iter().collect();
                if portions.is_empty()
                    || distinct.len() != portions.len()
                    || portions
                        .iter()
                        .any(|portion| !ticket.choices.contains(portion))
                {
                    return Err(InvalidSelection(id.into()));
                }
                tally.verified_meals = tally.verified_meals.checked_add(1).ok_or(CountOverflow)?;
                for portion in portions {
                    let quantity = tally.portions.entry(portion.clone()).or_default();
                    *quantity = quantity.checked_add(1).ok_or(CountOverflow)?;
                }
            }
            ReviewedDisposition::Excluded(_) => {
                tally.excluded_tickets =
                    tally.excluded_tickets.checked_add(1).ok_or(CountOverflow)?;
            }
        }
    }

    if let Some(id) = tickets.keys().find(|id| !seen.contains(**id)) {
        return Err(MissingReview((*id).into()));
    }
    Ok(tally)
}

pub fn estimate_food_cost(
    tally: &ProductionTally,
    portion_cost_cents: &BTreeMap<PortionKey, u64>,
) -> Result<FoodCost, ReconciliationError> {
    use ReconciliationError::CountOverflow;

    let mut cost = FoodCost {
        known_cents: 0,
        missing_portions: 0,
        verified_meals: tally.verified_meals,
    };
    for (portion, count) in &tally.portions {
        if let Some(unit_cost) = portion_cost_cents.get(portion) {
            let line_cost = unit_cost
                .checked_mul(u64::from(*count))
                .ok_or(CountOverflow)?;
            cost.known_cents = cost
                .known_cents
                .checked_add(line_cost)
                .ok_or(CountOverflow)?;
        } else {
            cost.missing_portions = cost
                .missing_portions
                .checked_add(*count)
                .ok_or(CountOverflow)?;
        }
    }
    Ok(cost)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn revision() -> TicketRevision {
        TicketRevision {
            menu: 1,
            diet_order: 2,
            choices: 3,
        }
    }

    fn portion(texture: &str) -> PortionKey {
        PortionKey {
            recipe_version: "synthetic-recipe-v1".into(),
            portion_code: "standard".into(),
            texture_code: texture.into(),
        }
    }

    fn print(id: &str, portion: PortionKey) -> PrintedTicket {
        PrintedTicket {
            id: id.into(),
            revision: revision(),
            choices: [portion].into(),
        }
    }

    fn review(id: &str, disposition: ReviewedDisposition) -> ReviewedTicket {
        ReviewedTicket {
            id: id.into(),
            printed_revision: revision(),
            reviewer_id: "synthetic-reviewer".into(),
            disposition,
        }
    }

    #[test]
    fn tallies_reviewed_portions_by_texture_and_cost_per_meal() {
        let regular = portion("regular");
        let modified = portion("modified");
        let printed = [
            print("a", regular.clone()),
            print("b", modified.clone()),
            print("c", regular.clone()),
        ];
        let current = printed
            .iter()
            .map(|ticket| (ticket.id.clone(), revision()))
            .collect();
        let reviewed = [
            review("a", ReviewedDisposition::Verified(vec![regular.clone()])),
            review("b", ReviewedDisposition::Verified(vec![modified.clone()])),
            review(
                "c",
                ReviewedDisposition::Excluded(ExclusionReason::NoOralService),
            ),
        ];
        let tally = reconcile(&printed, &current, &reviewed).unwrap();
        assert_eq!(tally.verified_meals, 2);
        assert_eq!(tally.excluded_tickets, 1);
        assert_eq!(
            tally.portions,
            [(regular.clone(), 1), (modified.clone(), 1)].into()
        );

        let partial = estimate_food_cost(&tally, &[(regular.clone(), 200)].into()).unwrap();
        assert_eq!(partial.known_cents, 200);
        assert_eq!(partial.missing_portions, 1);
        assert_eq!(partial.cost_per_verified_meal_cents(), None);

        let complete =
            estimate_food_cost(&tally, &[(regular, 200), (modified, 301)].into()).unwrap();
        assert_eq!(complete.cost_per_verified_meal_cents(), Some(251));
    }

    #[test]
    fn blocks_incomplete_duplicate_unknown_and_superseded_returns() {
        let choice = portion("regular");
        let printed = [print("a", choice.clone())];
        let mut current = BTreeMap::from([("a".into(), revision())]);
        let accepted = review("a", ReviewedDisposition::Verified(vec![choice.clone()]));

        assert_eq!(
            reconcile(&printed, &current, &[]),
            Err(ReconciliationError::MissingReview("a".into()))
        );
        assert_eq!(
            reconcile(&printed, &current, &[accepted.clone(), accepted.clone()]),
            Err(ReconciliationError::DuplicateReview("a".into()))
        );
        let unknown = review("b", ReviewedDisposition::Verified(vec![choice]));
        assert_eq!(
            reconcile(&printed, &current, &[unknown]),
            Err(ReconciliationError::UnknownTicket("b".into()))
        );

        current.get_mut("a").unwrap().diet_order += 1;
        assert_eq!(
            reconcile(&printed, &current, &[accepted]),
            Err(ReconciliationError::StaleTicket("a".into()))
        );
    }

    #[test]
    fn detects_a_new_expected_ticket_and_duplicate_packet_rows() {
        let choice = portion("regular");
        let ticket = print("a", choice.clone());
        let current = [("a".into(), revision()), ("new".into(), revision())].into();
        let reviewed = [review("a", ReviewedDisposition::Verified(vec![choice]))];
        assert_eq!(
            reconcile(std::slice::from_ref(&ticket), &current, &reviewed),
            Err(ReconciliationError::TicketNotPrinted("new".into()))
        );
        assert_eq!(
            reconcile(&[ticket.clone(), ticket], &current, &reviewed),
            Err(ReconciliationError::DuplicatePrintedTicket("a".into()))
        );
    }

    #[test]
    fn requires_reviewer_and_exact_printed_options() {
        let choice = portion("regular");
        let printed = [print("a", choice.clone())];
        let current = [("a".into(), revision())].into();
        let wrong_portion = review(
            "a",
            ReviewedDisposition::Verified(vec![portion("modified")]),
        );
        assert_eq!(
            reconcile(&printed, &current, &[wrong_portion]),
            Err(ReconciliationError::InvalidSelection("a".into()))
        );
        let duplicate_choice = review(
            "a",
            ReviewedDisposition::Verified(vec![choice.clone(), choice]),
        );
        assert_eq!(
            reconcile(&printed, &current, &[duplicate_choice]),
            Err(ReconciliationError::InvalidSelection("a".into()))
        );
        let missing_reviewer = ReviewedTicket {
            reviewer_id: " ".into(),
            ..review(
                "a",
                ReviewedDisposition::Excluded(ExclusionReason::NoMealRequired),
            )
        };
        assert_eq!(
            reconcile(&printed, &current, &[missing_reviewer]),
            Err(ReconciliationError::MissingReviewer("a".into()))
        );
    }
}
