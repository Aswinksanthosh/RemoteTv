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

## Biggest risk (test first)

It is NOT known whether ADB can change the TCL picture backlight. Test on the TV:

```
adb connect <tv-ip>:5555
adb shell settings list system
adb shell settings list global
adb shell settings put system screen_brightness 50
```

Look for keys with `bright`, `backlight` or `picture` and see whether the picture changes. If nothing works, look for other routes (picture mode presets via TCL/Fire TV settings, an overlay dimmer app) before writing the schedule.

## Status

Planning only. ADB debugging not confirmed enabled yet. Brightness test not run yet.

## Open questions

- Keep this repo private (simple install by copying the folder) or public (one-line installer and Update button like RemotePc)?
- Night starts at sunset or a fixed time? How dim (about 20 to 30 percent)?
- PIN: same as RemotePc (QR key plus optional PIN)?
- DHCP reservation for the TV possible?
