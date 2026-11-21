import { modeAt } from './schedule.mjs';

const MODES = ['day', 'evening', 'night'];

export class Controller {
  constructor({ cfg, tv, saveCfg = () => {}, loadState = () => ({}), saveState = () => {}, now = () => new Date() }) {
    Object.assign(this, { cfg, tv, saveCfg, saveState, now });
    const s = loadState() || {};
    this.s = {
      override: s.override || null,
      applied: s.applied || null, appliedLevel: s.appliedLevel ?? null,
      lastApplyAt: s.lastApplyAt || null, lastError: null, reachable: null, awake: null,
    };
    this.retryAfter = 0;
    this.busy = false;
    this.lastTick = 0;
  }

  _save() {
    const { override, applied, appliedLevel, lastApplyAt } = this.s;
    this.saveState({ override, applied, appliedLevel, lastApplyAt });
  }

  auto() { return modeAt(this.now(), this.cfg); }

  desired() {
    if (!this.cfg.autoSchedule) return this.s.override ? this.s.override.mode : this.s.applied;   // manual only
    const a = this.auto();
    const o = this.s.override;
    if (o && o.autoAt === a.mode) return o.mode;
    if (o) { this.s.override = null; this._save(); }  // schedule moved on: manual choice ends
    return a.mode;
  }

  async tick({ force = false } = {}) {
    if (this.busy) { if (force) this.s.lastError = 'Busy, try again in a moment'; return; }
    if (!this.cfg.autoSchedule && !force) return;
    // A long gap means the laptop was asleep: apply the right level again once.
    const t = this.now().getTime();
    if (this.lastTick && t - this.lastTick > 5 * 60000) { this.s.applied = null; this.retryAfter = 0; }
    this.lastTick = t;
    const want = this.desired();
    if (!want) { if (force) this.s.lastError = 'Choose Day, Evening or Night first'; return; }
    const level = want === 'day' ? 'reset' : this.cfg.levels[want];   // Day = press Reset
    if (!force) {
      if (this.s.applied === want && this.s.appliedLevel === level) return;
      if (this.now().getTime() < this.retryAfter) return;
    }
    this.busy = true;
    try {
      this.s.reachable = await this.tv.connect();
      if (!this.s.reachable) throw new Error('TV not reachable (is it on, ADB debugging enabled, same IP?)');
      this.s.awake = await this.tv.isAwake();
      if (!this.s.awake) {
        if (force) this.s.lastError = 'TV is asleep';
        return;  // catches up when the TV wakes
      }
      if (want === 'day') await this.tv.resetBacklight();
      else await this.tv.setBacklight(level);
      Object.assign(this.s, { applied: want, appliedLevel: level, lastApplyAt: this.now().toISOString(), lastError: null });
      this.retryAfter = 0;
      this._save();
    } catch (e) {
      this.s.lastError = String(e.message || e);
      this.retryAfter = this.now().getTime() + 2 * 60000;
    } finally {
      this.busy = false;
    }
  }

  async setMode(mode) {
    if (mode === 'auto') this.s.override = null;
    else if (MODES.includes(mode)) this.s.override = { mode, autoAt: this.auto().mode };
    else throw new Error('unknown mode');
    this._save();
    await this.tick({ force: true });
    return this.snapshot();
  }

  async setAuto(on) {
    this.cfg.autoSchedule = !!on;
    this.saveCfg(this.cfg);
    if (on) { this.s.override = null; this._save(); await this.tick(); }
    return this.snapshot();
  }

  async setLevels(levels, sanitize) {
    this.cfg.levels = sanitize(levels, this.cfg.levels);
    this.saveCfg(this.cfg);
    await this.tick();
    return this.snapshot();
  }

  async reapply() { await this.tick({ force: true }); return this.snapshot(); }

  snapshot() {
    const a = this.auto();
    const want = this.desired();
    const on = !!this.cfg.autoSchedule;
    return {
      mode: want, scheduleMode: a.mode, autoOn: on, level: want ? (want === 'day' ? 'reset' : this.cfg.levels[want]) : null,
      applied: this.s.applied, appliedLevel: this.s.appliedLevel,
      override: this.s.override ? this.s.override.mode : null,
      next: on && a.next ? { mode: a.next.mode, at: a.next.at.toISOString() } : null,
      levels: { ...this.cfg.levels }, timezone: this.cfg.timezone,
      tv: { reachable: this.s.reachable, awake: this.s.awake },
      busy: this.busy, lastError: this.s.lastError, lastApplyAt: this.s.lastApplyAt,
    };
  }
}
