use eframe::egui;

#[cfg(any(target_os = "windows", target_os = "linux"))]
mod print;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
enum Meal {
    #[default]
    Breakfast,
    Lunch,
    Dinner,
}

impl Meal {
    const ALL: [Self; 3] = [Self::Breakfast, Self::Lunch, Self::Dinner];

    fn label(self) -> &'static str {
        match self {
            Self::Breakfast => "Breakfast",
            Self::Lunch => "Lunch",
            Self::Dinner => "Dinner",
        }
    }
}

#[derive(Default)]
struct Worklist {
    meal: Meal,
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    print_status: String,
}

impl eframe::App for Worklist {
    fn ui(&mut self, ui: &mut egui::Ui, _: &mut eframe::Frame) {
        egui::ScrollArea::vertical().show(ui, |ui| {
            ui.spacing_mut().interact_size.y = 48.0;
            ui.heading("Tray worklist");
            ui.label("Platform proof · Facility connection required");
            ui.separator();

            ui.label("Meal");
            for meal in Meal::ALL {
                if ui
                    .selectable_label(self.meal == meal, meal.label())
                    .clicked()
                {
                    self.meal = meal;
                }
            }

            ui.separator();
            ui.strong(format!("{} trays", self.meal.label()));
            ui.label("No trays loaded. Tray checks are unavailable until a facility is connected.");
            #[cfg(any(target_os = "windows", target_os = "linux"))]
            {
                ui.separator();
                ui.label("Prints a sample page without facility records.");
                if ui.button("Print platform test page").clicked() {
                    self.print_status = print::submit().unwrap_or_else(|message| message);
                }
                if !self.print_status.is_empty() {
                    ui.label(&self.print_status);
                }
            }
        });
    }
}

pub fn run(options: eframe::NativeOptions) -> eframe::Result {
    eframe::run_native(
        "ShorelineOps · Platform Proof",
        options,
        Box::new(|_| Ok(Box::new(Worklist::default()))),
    )
}

#[cfg(target_os = "android")]
#[unsafe(no_mangle)]
fn android_main(app: winit::platform::android::activity::AndroidApp) {
    if let Err(error) = run(eframe::NativeOptions {
        android_app: Some(app),
        ..Default::default()
    }) {
        eprintln!("ShorelineOps window could not start: {error}");
    }
}
