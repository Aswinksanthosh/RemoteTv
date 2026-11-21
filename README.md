# RemoteTv

Automatic backlight schedule (day, evening, night) for a **Fire TV Edition TV** (tested idea on a TCL, Fire OS 8), controlled from a phone page. It runs on an always-on **Windows laptop** and presses the TV's remote buttons over ADB. Phone link goes through Tailscale. Plain Node.js, no dependencies.

**Status: first version, written but NOT yet run against the real TV. Test step by step below.**

## What you need
- Windows laptop (always on) with Node.js 18+ (`winget install OpenJS.NodeJS.LTS`), ADB (`winget install Google.PlatformTools`) and Tailscale
- The TV: Settings > Device & Software > About, select the device name 7 times, then Developer Options > ADB debugging ON
- Phone with Tailscale (same account as the laptop)

## Try it in this order
1. Look at the plan without touching the TV: `node bin/set-backlight.mjs 40 --dry`
2. One real change: `node bin/set-backlight.mjs 40 --tv <tv-ip>` (watch the TV; Backlight should end at 40 and the menu close)
3. Run the app: `node bin/remotetv.mjs --tv <tv-ip>`. It prints the phone link once (keep it private). New link later: `node bin/pair.mjs`
4. Open the link on the phone (Tailscale on).

## How it works
- Day starts at sunrise, evening 60 min before sunset, night 120 min after sunset (calculated for the configured location, no internet needed). Levels default to 78 / 55 / 30.
- The TV's Backlight slider has no direct setting, so the laptop opens Settings > Picture and moves the slider: all the way left, then right to the target.
- Waits while the TV is asleep and catches up when it wakes. A manual choice lasts until the next scheduled change. Pause stops the schedule.
- Safety: only loopback and Tailscale addresses, a long key per phone (only its fingerprint is stored), 5 wrong tries lock out for 5 minutes, fixed actions only.

Settings and the key live in `%USERPROFILE%\.remotetv` (never in this repo). Run the tests with `node --test`.

See [context.md](context.md) for decisions and open items.
