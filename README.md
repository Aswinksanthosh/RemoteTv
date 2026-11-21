# RemoteTv

Automatic backlight schedule (day, evening, night) for a **Fire TV Edition TV** (tested idea on a TCL, Fire OS 8), controlled from a phone page. It runs on an always-on **Windows laptop** and presses the TV's remote buttons over ADB. Phone link goes through Tailscale. Plain Node.js, no dependencies.

**Status: first version. Unit-tested, not yet verified on the real TV or a real Windows install.**

## Setup: one button
1. On the TV: Settings > Device & Software > About, select the device name 7 times, then Developer Options > **ADB debugging ON**. Note the IP address (About > Network).
2. On the laptop: get this folder (`git clone`, or `git pull` if you have it) and double-click **Install.cmd**. Say Yes to the administrator question once. It installs Node.js, Git and ADB if missing, asks for the TV IP, connects to the TV (accept the "Allow debugging?" box on the TV, tick Always allow), opens the firewall for Tailscale addresses only, starts RemoteTv at every sign-in, and shows a **QR code**.
3. On the phone (Tailscale on, same account as the laptop): scan the QR code and Add to Home Screen. Done. You do not need to touch the laptop again.

From the phone page: Day / Evening / Night now, back to schedule, pause, change levels, **Apply backlight now (test)**, and **Update the program** (runs `git pull` on the laptop and restarts). New phone: double-click **Pair-Phone.cmd**. Remove: **Uninstall.cmd**.

Needs a Windows laptop that stays on, Tailscale on laptop and phone, and the folder must be a git clone for the Update button.

Manual commands: `node bin/set-backlight.mjs 40 --tv <ip> [--dry] [--force]` tests the key presses; `node bin/remotetv.mjs` runs the app.

## How it works
- Day starts at sunrise, evening 60 min before sunset, night 120 min after sunset (calculated for the configured location, no internet needed). Levels default to 78 / 55 / 30.
- The TV's Backlight slider has no direct setting, so the laptop opens Settings > Picture and moves the slider: all the way left, then right to the target.
- Waits while the TV is asleep and catches up when it wakes. A manual choice lasts until the next scheduled change. Pause stops the schedule.
- Safety: only loopback and Tailscale addresses, a long key per phone (only its fingerprint is stored), 5 wrong tries lock out for 5 minutes, fixed actions only.

Settings and the key live in `%USERPROFILE%\.remotetv` (never in this repo). Run the tests with `node --test`.

See [context.md](context.md) for decisions and open items.
