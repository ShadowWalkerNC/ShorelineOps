#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

#[cfg(not(target_os = "android"))]
fn main() -> eframe::Result {
    shorelineops_client::run(eframe::NativeOptions {
        viewport: eframe::egui::ViewportBuilder::default().with_inner_size([800.0, 600.0]),
        ..Default::default()
    })
}

#[cfg(target_os = "android")]
fn main() {}
