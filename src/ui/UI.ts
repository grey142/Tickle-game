import type { Cheats } from '../game/types';
import { RESOLVE_MAX, STAMINA_MAX } from '../game/types';
import { GALLERY_ORDER, MONSTER_DEFS } from '../data/MonsterDefs';
import { MISSION_TITLES } from '../data/MissionData';

export type MenuScreen = 'none' | 'main' | 'pause' | 'cheats' | 'gallery' | 'help' | 'gameover' | 'levelclear' | 'missionclear';

export class UI {
  resolveFill: HTMLElement;
  staminaFill: HTMLElement;
  struggleFill: HTMLElement;
  resolveLabel: HTMLElement;
  staminaLabel: HTMLElement;
  struggleRow: HTMLElement;
  struggleLabel: HTMLElement;
  overlay: HTMLElement;
  menuCard: HTMLElement;
  toastEl: HTMLElement;
  onAction: (action: string, payload?: string) => void = () => {};

  constructor(root: HTMLElement) {
    this.resolveFill = root.querySelector('#resolveFill')!;
    this.staminaFill = root.querySelector('#staminaFill')!;
    this.struggleFill = root.querySelector('#struggleFill')!;
    this.resolveLabel = root.querySelector('#resolveLabel')!;
    this.staminaLabel = root.querySelector('#staminaLabel')!;
    this.struggleRow = root.querySelector('#struggleRow')!;
    this.struggleLabel = root.querySelector('#struggleLabel')!;
    this.overlay = root.querySelector('#overlay')!;
    this.menuCard = root.querySelector('#menuCard')!;
    this.toastEl = root.querySelector('#toast')!;
  }

  updateBars(resolve: number, stamina: number, struggleActive: boolean, struggle: number) {
    const rp = Math.max(0, Math.min(1, resolve / RESOLVE_MAX));
    const sp = Math.max(0, Math.min(1, stamina / STAMINA_MAX));
    this.resolveFill.style.width = `${rp * 100}%`;
    this.staminaFill.style.width = `${sp * 100}%`;
    this.resolveLabel.textContent = `${Math.ceil(resolve)} / ${RESOLVE_MAX}`;
    this.staminaLabel.textContent = `${Math.ceil(stamina)} / ${STAMINA_MAX}`;
    if (struggleActive) {
      this.struggleRow.classList.add('active');
      this.struggleFill.style.width = `${Math.max(0, Math.min(100, struggle))}%`;
      this.struggleLabel.textContent = `${Math.floor(struggle)}% — mash E / Space!`;
    } else {
      this.struggleRow.classList.remove('active');
    }
  }

  toast(msg: string) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove('show');
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('show');
  }

  hide() {
    this.overlay.classList.remove('show');
    this.menuCard.innerHTML = '';
  }

  showMain(unlocked: number, cheats: Cheats) {
    const maxUnlock = cheats.unlockAllMissions ? 10 : unlocked;
    let missions = '';
    for (let i = 1; i <= 10; i++) {
      const locked = i > maxUnlock;
      missions += `<button class="menu-btn ${locked ? 'secondary' : ''}" data-act="play" data-payload="${i}" ${locked ? 'disabled' : ''}>
        M${i}: ${MISSION_TITLES[i - 1]}${locked ? ' 🔒' : ''}
      </button>`;
    }
    this.menuCard.innerHTML = `
      <h1>Tickle Struggle</h1>
      <p>Adult fantasy action — slash, dash, and mash free of teasing monsters. Reach each exit shrine. Tasteful chaos only.</p>
      <h2>Missions</h2>
      <div class="mission-grid">${missions}</div>
      <div class="btn-row">
        <button class="menu-btn" data-act="continue">Continue</button>
        <button class="menu-btn secondary" data-act="gallery">Enemy Gallery</button>
        <button class="menu-btn secondary" data-act="cheats">Cheats</button>
        <button class="menu-btn secondary" data-act="help">Controls</button>
      </div>
    `;
    this.bind();
    this.overlay.classList.add('show');
  }

  showPause() {
    this.menuCard.innerHTML = `
      <h1>Paused</h1>
      <p>Take a breath. The ticklers can wait.</p>
      <div class="btn-row">
        <button class="menu-btn" data-act="resume">Resume</button>
        <button class="menu-btn secondary" data-act="cheats">Cheats</button>
        <button class="menu-btn secondary" data-act="save">Save</button>
        <button class="menu-btn secondary" data-act="help">Controls</button>
        <button class="menu-btn danger" data-act="quit">Quit to Menu</button>
      </div>
    `;
    this.bind();
    this.overlay.classList.add('show');
  }

  showCheats(cheats: Cheats, back: 'main' | 'pause') {
    const items: { key: keyof Cheats; label: string }[] = [
      { key: 'infiniteResolve', label: 'Infinite Resolve' },
      { key: 'infiniteStamina', label: 'Infinite Stamina' },
      { key: 'instantStruggle', label: 'Instant Struggle Escape' },
      { key: 'oneHitKill', label: 'One-Hit Kill' },
      { key: 'unlockAllMissions', label: 'Unlock All Missions' },
    ];
    this.menuCard.innerHTML = `
      <h1>Cheats</h1>
      <p>For practice, gallery fun, or skipping the grind.</p>
      <div class="cheat-list">
        ${items.map((it) => `
          <label><input type="checkbox" data-cheat="${it.key}" ${cheats[it.key] ? 'checked' : ''}/> ${it.label}</label>
        `).join('')}
      </div>
      <div class="btn-row">
        <button class="menu-btn" data-act="back-${back}">Back</button>
      </div>
    `;
    this.menuCard.querySelectorAll<HTMLInputElement>('[data-cheat]').forEach((el) => {
      el.addEventListener('change', () => {
        this.onAction('toggle-cheat', el.dataset.cheat);
      });
    });
    this.bind();
    this.overlay.classList.add('show');
  }

  showGallery() {
    const items = GALLERY_ORDER.map((id) => {
      const d = MONSTER_DEFS[id];
      return `<div class="gallery-item" data-act="gallery-preview" data-payload="${id}">
        <h3 style="color:${d.color}">${d.name}</h3>
        <p>${d.tier} · ${d.description}</p>
      </div>`;
    }).join('');
    this.menuCard.innerHTML = `
      <h1>Enemy Gallery</h1>
      <p>Click an enemy to preview tickle &amp; defeat animations on the side panel.</p>
      <div class="gallery-grid">${items}</div>
      <div class="btn-row">
        <button class="menu-btn" data-act="gallery-tickle">Preview Tickle</button>
        <button class="menu-btn secondary" data-act="gallery-gameover">Preview Defeat</button>
        <button class="menu-btn secondary" data-act="back-main">Back</button>
      </div>
    `;
    this.bind();
    this.overlay.classList.add('show');
  }

  showHelp(back: 'main' | 'pause') {
    this.menuCard.innerHTML = `
      <h1>Controls</h1>
      <p>
        <b>Move</b> — WASD / Arrow keys<br/>
        <b>Melee slash</b> — J / Left mouse (costs ${Math.round(500/8)} stamina)<br/>
        <b>Projectile slash</b> — K / Right mouse (125 stamina)<br/>
        <b>Dash</b> — L / Shift / Space when free (125 stamina; immune to grabs)<br/>
        <b>Struggle</b> — Mash E / Space while grabbed<br/>
        <b>Pause</b> — Esc<br/>
      </p>
      <p>Potions refill Resolve. Clear a level to refill and autosave. Hit 0 Resolve and the creature wins — level restarts from last save.</p>
      <div class="btn-row"><button class="menu-btn" data-act="back-${back}">Back</button></div>
    `;
    this.bind();
    this.overlay.classList.add('show');
  }

  showGameOver(enemyName: string) {
    this.menuCard.innerHTML = `
      <h1>Overcome</h1>
      <p>${enemyName} got the better of you. Resolve hit zero.</p>
      <div class="btn-row">
        <button class="menu-btn" data-act="restart-level">Restart Level</button>
        <button class="menu-btn secondary" data-act="quit">Main Menu</button>
      </div>
    `;
    this.bind();
    this.overlay.classList.add('show');
  }

  showLevelClear(mission: number, level: number) {
    this.menuCard.innerHTML = `
      <h1>Level Clear</h1>
      <p>Mission ${mission}-${level} complete. Resolve refilled. Progress autosaved.</p>
      <div class="btn-row">
        <button class="menu-btn" data-act="next-level">Continue</button>
        <button class="menu-btn secondary" data-act="quit">Main Menu</button>
      </div>
    `;
    this.bind();
    this.overlay.classList.add('show');
  }

  showMissionClear(mission: number) {
    this.menuCard.innerHTML = `
      <h1>Mission ${mission} Cleared!</h1>
      <p>Boss defeated. ${mission < 10 ? `Mission ${mission + 1} unlocked.` : 'All missions complete — legendary.'}</p>
      <div class="btn-row">
        <button class="menu-btn" data-act="quit">Main Menu</button>
        ${mission < 10 ? `<button class="menu-btn secondary" data-act="play" data-payload="${mission + 1}">Next Mission</button>` : ''}
      </div>
    `;
    this.bind();
    this.overlay.classList.add('show');
  }

  private bind() {
    this.menuCard.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => {
      el.addEventListener('click', () => {
        this.onAction(el.dataset.act!, el.dataset.payload);
      });
    });
  }
}
