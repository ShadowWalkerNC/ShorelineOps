use crate::{PortionKey, PrintedTicket};
use std::collections::BTreeMap;
use std::fmt::Write as _;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PaperTicketError {
    InvalidIdentifier,
    MissingServiceDetails,
    InvalidChoiceLabels,
}

/// Render the supplied revision as a selection form. The caller supplies an
/// opaque, non-identifying ticket ID and display labels from the same choice
/// snapshot. Rendering does not approve the ticket or record that it printed.
pub fn render_meal_selection_ticket(
    ticket: &PrintedTicket,
    service_date: &str,
    meal: &str,
    choice_labels: &BTreeMap<PortionKey, String>,
) -> Result<String, PaperTicketError> {
    if ticket.id.is_empty()
        || ticket.id.len() > 64
        || !ticket
            .id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
        || !ticket.id.bytes().any(|byte| byte.is_ascii_alphanumeric())
    {
        return Err(PaperTicketError::InvalidIdentifier);
    }
    if service_date.trim().is_empty() || meal.trim().is_empty() {
        return Err(PaperTicketError::MissingServiceDetails);
    }
    if choice_labels.is_empty()
        || choice_labels.len() != ticket.choices.len()
        || ticket.choices.iter().any(|key| {
            choice_labels
                .get(key)
                .is_none_or(|label| label.trim().is_empty())
        })
    {
        return Err(PaperTicketError::InvalidChoiceLabels);
    }

    let mut html = format!(
        r#"<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Meal selection ticket</title>
<style>
@page {{ size: Letter; margin: 0.65in; }}
body {{ margin: 0; color: #000; background: #fff; font: 12pt/1.45 system-ui, sans-serif; }}
main {{ max-width: 7.2in; margin: 0 auto; }}
h1 {{ margin: 0 0 0.15in; font-size: 22pt; }}
h2 {{ margin: 0.18in 0 0.08in; font-size: 15pt; }}
p {{ margin: 0.06in 0; }}
section {{ margin: 0.22in 0; border-top: 1pt solid; }}
code {{ overflow-wrap: anywhere; }}
ul {{ margin: 0; padding: 0; list-style: none; }}
li {{ display: flex; align-items: flex-start; gap: 0.12in; padding: 0.1in 0; border-bottom: 0.6pt solid; break-inside: avoid; overflow-wrap: anywhere; }}
.mark {{ flex: 0 0 0.24in; height: 0.24in; border: 1pt solid; }}
.notes {{ height: 0.8in; border: 1pt solid; margin-top: 0.08in; }}
.review {{ border: 2pt solid; padding: 0.12in; break-inside: avoid; }}
@media screen {{ body {{ padding: 1rem; }} }}
</style>
<main>
<h1>Meal selection ticket</h1>
<p><strong>Ticket ID:</strong> <code>{}</code></p>
<p><strong>Service date:</strong> {} &nbsp; <strong>Meal:</strong> {}</p>
<p><strong>Printed revisions:</strong> Menu {} · Diet order {} · Choices {}</p>
<section aria-labelledby="choices">
<h2 id="choices">Choices</h2>
<p>Mark the selections on paper and return this ticket for staff review.</p>
<ul>
"#,
        escape_html(&ticket.id),
        escape_html(service_date),
        escape_html(meal),
        ticket.revision.menu,
        ticket.revision.diet_order,
        ticket.revision.choices,
    );
    for (index, key) in ticket.choices.iter().enumerate() {
        writeln!(
            html,
            r#"<li><span class="mark" aria-hidden="true"></span><span>{}. {}</span></li>"#,
            index + 1,
            escape_html(&choice_labels[key])
        )
        .expect("writing to a string cannot fail");
    }
    html.push_str(
        r#"</ul>
</section>
<section aria-labelledby="notes">
<h2 id="notes">Notes for review</h2>
<div class="notes" aria-hidden="true"></div>
</section>
<p class="review"><strong>Staff review required.</strong> Reconcile this ticket against the current approved records before using its selections for kitchen counts.</p>
</main>
</html>
"#,
    );
    Ok(html)
}

fn escape_html(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&#39;"),
            _ => escaped.push(character),
        }
    }
    escaped
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::TicketRevision;

    fn sample(id: impl Into<String>) -> PrintedTicket {
        PrintedTicket {
            id: id.into(),
            revision: TicketRevision {
                menu: 3,
                diet_order: 7,
                choices: 5,
            },
            choices: [PortionKey {
                recipe_version: "synthetic-v1".into(),
                portion_code: "standard".into(),
                texture_code: "regular".into(),
            }]
            .into(),
        }
    }

    fn labels(ticket: &PrintedTicket, label: &str) -> BTreeMap<PortionKey, String> {
        ticket
            .choices
            .iter()
            .map(|key| (key.clone(), label.into()))
            .collect()
    }

    #[test]
    fn rejects_labels_for_a_different_portion() {
        let ticket = sample("A7K-29P");
        let mut key = ticket.choices.first().unwrap().clone();
        key.texture_code = "other".into();
        let labels = BTreeMap::from([(key, "Different portion".into())]);
        assert_eq!(
            render_meal_selection_ticket(&ticket, "2026-11-16", "Lunch", &labels),
            Err(PaperTicketError::InvalidChoiceLabels)
        );
    }

    #[test]
    fn stamps_source_revisions_and_escapes_dynamic_text() {
        let ticket = sample("A7K-29P");
        let html = render_meal_selection_ticket(
            &ticket,
            "2026-11-16<script>",
            "Lunch & \"tea\"",
            &labels(&ticket, "Chef's <choice>"),
        )
        .unwrap();
        assert!(html.contains("<code>A7K-29P</code>"));
        assert!(html.contains("Menu 3 · Diet order 7 · Choices 5"));
        assert!(html.contains("2026-11-16&lt;script&gt;"));
        assert!(html.contains("Lunch &amp; &quot;tea&quot;"));
        assert!(html.contains("Chef&#39;s &lt;choice&gt;"));
        assert!(!html.contains("<script>"));
    }

    #[test]
    fn rejects_ids_that_are_not_printable_opaque_codes() {
        for id in [
            "",
            "---",
            "name & room",
            "<x>",
            "A\nB",
            "é",
            &"A".repeat(65),
        ] {
            let ticket = sample(id);
            assert_eq!(
                render_meal_selection_ticket(
                    &ticket,
                    "2026-11-16",
                    "Lunch",
                    &labels(&ticket, "Option")
                ),
                Err(PaperTicketError::InvalidIdentifier),
                "{id:?}"
            );
        }
    }
}
