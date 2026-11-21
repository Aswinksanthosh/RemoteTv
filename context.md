# Context: RemoteTv

Read this first in any new session. Update it with every change or idea (owner's rule). Never put personal data in this repo (names, real IP or MAC addresses, serial numbers, keys, e-mail).

## Goal

A small app on an always-on Windows laptop that talks to a shared living-room TV over ADB (Wi-Fi) and is controlled from the owner's phone through Tailscale. Minimal changes to the TV: same launcher, nothing that annoys the roommates. Owner only.

## First feature

Automatic brightness: day, evening, night (dim at night), following real sunrise/sunset for Toronto. Optional later: adjust by cloud cover from a free weather API (no account). The owner can pause the schedule from the phone (roommates).

## The TV

- TCL 55Q550F-CA, Fire TV Edition, Fire OS 8.1.8.5. Not Google TV. About 9.5 GB storage, about 5.7 GB free.
- ADB works on Fire TV. The home launcher cannot easily be replaced (and we do not want to). CleanYourTV (Android/Google TV tool) is probably NOT suitable: check before trying.
- Enable ADB: Settings > Device & Software > About, select the device name 7 times, then Developer Options > ADB debugging.

## Design (copy the pattern of the owner's RemotePc repo)

- Plain Node.js, no dependencies, tests with `node --test`.
- Tailscale for the phone link, nothing opened to the internet. QR pairing key in the link, optional PIN, fixed list of actions only.
- Windows scheduled task started at sign-in, hidden launcher that restarts the program. Phone page with an Update button.
- Installer downloads Google platform-tools (ADB) if missing (or `winget install Google.PlatformTools`).
- Phone page (draft): current mode and brightness, Day / Evening / Night buttons, Pause schedule, Update.
- The TV's IP can change: prefer a router DHCP reservation, else rediscover.

## Biggest risk (resolved: use key presses, see test results)

It is NOT known whether ADB can change the TCL picture backlight. Test on the TV:

```
adb connect <tv-ip>:5555
adb shell settings list system
adb shell settings list global
adb shell settings put system screen_brightness 50
```

Look for keys with `bright`, `backlight` or `picture` and see whether the picture changes. If nothing works, look for other routes (picture mode presets via TCL/Fire TV settings, an overlay dimmer app) before writing the schedule.

## Test results (2026-11-21)

- ADB over Wi-Fi works from Windows (winget `Google.PlatformTools`; if `adb` is not found, restart the shell or call the full path under `%LOCALAPPDATA%\Microsoft\WinGet\Packages`).
- The generic Android settings `screen_brightness` / `screen_brightness_float` exist but do NOT change the TV backlight.
- The picture menu (Picture - Apps & Videos - SDR: Picture Mode, Reset, Backlight, Contrast) is not visible to `uiautomator` or `dumpsys window`; assume a system overlay. Control it with key presses.
- Hardware is MediaTek. A broadcast `com.amazon.tv.pqsettings.action.SWITCH_PICTURE_MODE` exists; sent without extras it completes with result=0 and does nothing visible. Extras unknown.
- WORKS: press keys by ADB. Sequence: Home (3), Settings (176), Down x2 (20), OK (23) = Picture, Down x2 = Backlight, then Left (21) / Right (22) change the value. 5 Left then 5 Right moved the slider and restored it.
- Picture modes: Standard, Movie, Dynamic, Natural, Custom, plus PC and Game for HDMI. Backlight is stored per mode and per content type (Apps & Videos SDR, HDR, HDMI...), so dimming only one mode misses the others.

## Idea: run on the TV itself

Termux (sideloaded) on the Fire TV with `adb connect localhost:5555`, Termux:Boot to start, Tailscale Android TV app for the phone page. Keep the code portable (ADB path and host configurable) so it runs on the laptop first and can move later. Risks: Fire OS may kill background apps; the menu flashes about 8 seconds on screen, so apply changes at wake-up or quiet times; when the TV is off, catch up to the correct level on wake.

## Status

Planning. Key-press brightness change confirmed to work from the laptop. Not built yet.

## Open questions

- Keep this repo private (simple install by copying the folder) or public (one-line installer and Update button like RemotePc)?
- Night starts at sunset or a fixed time? How dim (about 20 to 30 percent)?
- PIN: same as RemotePc (QR key plus optional PIN)?
- DHCP reservation for the TV possible?
