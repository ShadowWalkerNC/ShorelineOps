#![windows_subsystem = "windows"]

use std::{io, ptr::null_mut};
use windows_sys::{
    Win32::{
        Foundation::{HWND, LPARAM, LRESULT, WPARAM},
        Graphics::Gdi::{COLOR_WINDOW, DEFAULT_GUI_FONT, GetStockObject},
        System::LibraryLoader::GetModuleHandleW,
        UI::WindowsAndMessaging::*,
    },
    w,
};

const RESULT_ID: usize = 100;
const FIRST_CASE_ID: usize = 101;
const CASES: [(&str, &str); 3] = [
    ("NPO order", "Demo resident A has an active NPO order."),
    (
        "Allergen conflict",
        "Demo resident B has a milk allergy. The sample tray contains milk.",
    ),
    (
        "Texture mismatch",
        "Demo resident C requires puréed food. The sample tray contains a regular-texture item.",
    ),
];

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain([0]).collect()
}

fn main() {
    // All window handles and message dispatch stay on this thread.
    unsafe {
        if let Err(error) = run() {
            MessageBoxW(
                null_mut(),
                wide(&error.to_string()).as_ptr(),
                w!("ShorelineOps Native"),
                MB_OK | MB_ICONERROR,
            );
            std::process::exit(1);
        }
    }
}

unsafe fn run() -> io::Result<()> {
    unsafe {
        let instance = GetModuleHandleW(null_mut());
        if instance.is_null() {
            return Err(io::Error::last_os_error());
        }

        let class = WNDCLASSW {
            lpfnWndProc: Some(window_proc),
            hInstance: instance,
            hCursor: LoadCursorW(null_mut(), IDC_ARROW),
            hbrBackground: (COLOR_WINDOW as usize + 1) as _,
            lpszClassName: w!("ShorelineOpsNative"),
            ..Default::default()
        };
        if RegisterClassW(&class) == 0 {
            return Err(io::Error::last_os_error());
        }

        let window = CreateWindowExW(
            0,
            class.lpszClassName,
            w!("ShorelineOps Native — Training Preview"),
            WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX,
            CW_USEDEFAULT,
            CW_USEDEFAULT,
            656,
            360,
            null_mut(),
            null_mut(),
            instance,
            null_mut(),
        );
        if window.is_null() {
            return Err(io::Error::last_os_error());
        }

        ShowWindow(window, SW_SHOW);
        let mut message = MSG::default();
        loop {
            match GetMessageW(&mut message, null_mut(), 0, 0) {
                -1 => return Err(io::Error::last_os_error()),
                0 => return Ok(()),
                _ if IsDialogMessageW(window, &message) != 0 => {}
                _ => {
                    TranslateMessage(&message);
                    DispatchMessageW(&message);
                }
            }
        }
    }
}

unsafe extern "system" fn window_proc(
    window: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    unsafe {
        match message {
            WM_CREATE => {
                if create_controls(window) {
                    0
                } else {
                    -1
                }
            }
            WM_COMMAND if lparam != 0 && (wparam >> 16) as u32 == BN_CLICKED => {
                let id = wparam & 0xffff;
                if let Some((_, detail)) = id
                    .checked_sub(FIRST_CASE_ID)
                    .and_then(|index| CASES.get(index))
                {
                    let result = GetDlgItem(window, RESULT_ID as i32);
                    let description = wide(&format!("TRAINING RESULT — HOLD TRAY\r\n\r\n{detail}"));
                    SetWindowTextW(result, description.as_ptr());
                    // Focus the read-only result so keyboard and screen-reader users can review it.
                    windows_sys::Win32::UI::Input::KeyboardAndMouse::SetFocus(result);
                }
                0
            }
            WM_DESTROY => {
                PostQuitMessage(0);
                0
            }
            _ => DefWindowProcW(window, message, wparam, lparam),
        }
    }
}

fn create_controls(window: HWND) -> bool {
    let control = |class, text: &str, style, id, x, y, width, height| {
        // CreateWindowExW copies the UTF-16 label during the call.
        unsafe {
            let handle = CreateWindowExW(
                0,
                class,
                wide(text).as_ptr(),
                WS_CHILD | WS_VISIBLE | style,
                x,
                y,
                width,
                height,
                window,
                id as HMENU,
                null_mut(),
                null_mut(),
            );
            if handle.is_null() {
                return false;
            }
            SendMessageW(
                handle,
                WM_SETFONT,
                GetStockObject(DEFAULT_GUI_FONT) as usize,
                1,
            );
            true
        }
    };

    if !control(w!("STATIC"), "Tray safety training", 0, 0, 24, 24, 590, 22)
        || !control(
            w!("STATIC"),
            "Synthetic examples only. Choose a scenario to see why a tray is held.",
            0,
            0,
            24,
            54,
            590,
            32,
        )
    {
        return false;
    }

    for (index, (label, _)) in CASES.iter().enumerate() {
        if !control(
            w!("BUTTON"),
            label,
            WS_TABSTOP,
            FIRST_CASE_ID + index,
            24 + index as i32 * 200,
            96,
            184,
            48,
        ) {
            return false;
        }
    }

    control(
        w!("EDIT"),
        "Select a scenario above.",
        WS_TABSTOP | WS_BORDER | ES_MULTILINE as u32 | ES_READONLY as u32,
        RESULT_ID,
        24,
        168,
        584,
        118,
    )
}
