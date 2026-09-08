import './style.css';
import { Game } from './game/Game';
import { UI } from './ui/UI';
import { CharacterPanel } from './ui/CharacterPanel';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="game-shell">
    <div id="playfield-wrap">
      <div id="floatingHelp">
        WASD move » J/LMB slash » K/RMB projectile » L/Shift/Space dash<br/>
        Grabbed? Mash <b>E</b> / <b>Space</b> » Esc pause » Potions refill Resolve
      </div>
      <canvas id="gameCanvas"></canvas>
      <div id="toast" class="toast"></div>
      <div id="overlay" class="overlay">
        <div id="menuCard" class="menu-card"></div>
      </div>
    </div>
    <div class="side-col">
      <div id="charPanel">
        <div class="panel-label">Hero</div>
        <canvas id="charCanvas"></canvas>
      </div>
      <div id="hudBars">
        <div class="bar-row">
          <div class="bar-label"><span>Resolve</span><span id="resolveLabel">1500 / 1500</span></div>
          <div class="bar-track"><div id="resolveFill" class="bar-fill resolve"></div></div>
        </div>
        <div class="bar-row">
          <div class="bar-label"><span>Stamina</span><span id="staminaLabel">500 / 500</span></div>
          <div class="bar-track"><div id="staminaFill" class="bar-fill stamina"></div></div>
        </div>
        <div class="bar-row" id="struggleRow">
          <div class="bar-label"><span>Struggle</span><span id="struggleLabel">0%</span></div>
          <div class="bar-track"><div id="struggleFill" class="bar-fill struggle"></div></div>
        </div>
        <p class="help-mini">Green Resolve » Blue Stamina » Yellow Struggle while grabbed</p>
      </div>
    </div>
  </div>
`;


const canvas = document.querySelector<HTMLCanvasElement>('#gameCanvas')!;
const charCanvas = document.querySelector<HTMLCanvasElement>('#charCanvas')!;
const ui = new UI(app);
const panel = new CharacterPanel(charCanvas);
new Game(canvas, ui, panel);
