const TITLE: &str = "ShorelineOps platform test";

#[cfg(target_os = "linux")]
pub fn submit() -> Result<String, String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    let mut job = Command::new("lp")
        .args(["-t", TITLE, "-"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Could not start CUPS printing: {error}"))?;
    let written = job
        .stdin
        .take()
        .ok_or_else(|| "CUPS print input unavailable.".to_owned())?
        .write_all(b"ShorelineOps platform test\nNo facility records.\n");
    let output = job.wait_with_output().map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "Print submission failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    written.map_err(|error| error.to_string())?;
    Ok("Test page submitted to the default print queue.".into())
}

#[cfg(target_os = "windows")]
pub fn submit() -> Result<String, String> {
    use std::mem::size_of;
    use windows_sys::Win32::{
        Foundation::GlobalFree,
        Graphics::Gdi::{DeleteDC, GetDeviceCaps, LOGPIXELSX, LOGPIXELSY, TextOutW},
        Storage::Xps::{AbortDoc, DOCINFOW, EndDoc, EndPage, StartDocW, StartPage},
        UI::{
            Controls::Dialogs::{
                CommDlgExtendedError, PD_NOPAGENUMS, PD_NOSELECTION, PD_RETURNDC, PRINTDLGW,
                PrintDlgW,
            },
            Input::KeyboardAndMouse::GetActiveWindow,
        },
    };

    // The common dialog owns printer selection. Free the handles it returns on
    // both cancel and success, and abort an incomplete document on any failure.
    unsafe {
        let mut dialog = PRINTDLGW {
            lStructSize: size_of::<PRINTDLGW>() as u32,
            hwndOwner: GetActiveWindow(),
            Flags: PD_RETURNDC | PD_NOPAGENUMS | PD_NOSELECTION,
            nCopies: 1,
            ..Default::default()
        };
        let selected = PrintDlgW(&mut dialog) != 0;
        let dialog_error = if selected { 0 } else { CommDlgExtendedError() };
        for handle in [dialog.hDevMode, dialog.hDevNames] {
            if !handle.is_null() {
                GlobalFree(handle);
            }
        }
        let dc = dialog.hDC;
        if !selected {
            if !dc.is_null() {
                DeleteDC(dc);
            }
            return if dialog_error == 0 {
                Ok("Print canceled.".into())
            } else {
                Err(format!(
                    "Could not open printer selection ({dialog_error})."
                ))
            };
        }
        if dc.is_null() {
            return Err("The selected printer returned no print context.".into());
        }

        let title: Vec<u16> = TITLE.encode_utf16().chain([0]).collect();
        let content: Vec<u16> = "ShorelineOps platform test - no facility records"
            .encode_utf16()
            .collect();
        let doc = DOCINFOW {
            cbSize: size_of::<DOCINFOW>() as i32,
            lpszDocName: title.as_ptr(),
            ..Default::default()
        };
        let started = StartDocW(dc, &doc) > 0;
        let submitted = started
            && StartPage(dc) > 0
            && TextOutW(
                dc,
                GetDeviceCaps(dc, LOGPIXELSX as i32) / 2,
                GetDeviceCaps(dc, LOGPIXELSY as i32) / 2,
                content.as_ptr(),
                content.len() as i32,
            ) != 0
            && EndPage(dc) > 0
            && EndDoc(dc) > 0;
        if started && !submitted {
            AbortDoc(dc);
        }
        DeleteDC(dc);
        if submitted {
            Ok("Test page submitted to the selected print queue.".into())
        } else {
            Err("Print submission failed.".into())
        }
    }
}
