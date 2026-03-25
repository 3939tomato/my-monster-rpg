let monsters = [];
let editingMonsterId = null;
const MAX_MONSTERS = 5; 
const MAX_PARTY = 3;    

// 階層記録
let maxClearedFloor = parseInt(localStorage.getItem('dot_max_cleared') || '0');

const ENEMY_IMAGES = ['スケルトン.png', 'ゾンビ.png', 'ブルースライム.png', 'レッドスライム.png'];
const BOSS_IMAGE = 'ドラゴン.png';

const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const container = document.getElementById('canvas-container');
const statusDisplay = document.getElementById('status-display');
const gridSizeSelect = document.getElementById('gridSize');

let currentGridSize = 32;
let currentTool = 'pen';
let isDrawing = false;
let viewState = { scale: 10, pointX: 0, pointY: 0, startX: 0, startY: 0, panning: false };

window.onload = () => {
    const saved = localStorage.getItem('dot_monsters');
    if (saved) {
        monsters = JSON.parse(saved);
    }
    renderMonsterList();
    spawnMonstersInField(); 
    initCanvas();
    resetView();
    setupCanvasEvents();
};

function initCanvas() {
    canvas.width = currentGridSize;
    canvas.height = currentGridSize;
    ctx.imageSmoothingEnabled = false;
}

function updateTransform() {
    canvas.style.transform = `translate(${viewState.pointX}px, ${viewState.pointY}px) scale(${viewState.scale})`;
    statusDisplay.textContent = `Size: ${currentGridSize}x${currentGridSize} | Zoom: ${Math.round(viewState.scale * 10)}%`;
}

function zoom(factor) {
    viewState.scale = Math.max(1, Math.min(viewState.scale * factor, 80));
    updateTransform();
}

function resetView() {
    viewState.scale = Math.floor(Math.min(container.clientWidth, container.clientHeight) / currentGridSize * 0.8);
    viewState.pointX = (container.clientWidth - currentGridSize * viewState.scale) / 2;
    viewState.pointY = (container.clientHeight - currentGridSize * viewState.scale) / 2;
    updateTransform();
}

gridSizeSelect.onchange = () => {
    if(confirm("絵が消えますがよろしいですか？")) {
        currentGridSize = parseInt(gridSizeSelect.value);
        initCanvas();
        resetView();
    }
};

function setupCanvasEvents() {
    container.onpointerdown = (e) => {
        if (e.button === 1 || e.shiftKey) { viewState.panning = true; viewState.startX = e.clientX - viewState.pointX; viewState.startY = e.clientY - viewState.pointY; return; }
        isDrawing = true; execTool(e);
    };
    window.onpointermove = (e) => {
        if (viewState.panning) { viewState.pointX = e.clientX - viewState.startX; viewState.pointY = e.clientY - viewState.startY; updateTransform(); }
        else if (isDrawing) execTool(e);
    };
    window.onpointerup = () => { isDrawing = false; viewState.panning = false; };
}

function execTool(e) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / viewState.scale);
    const y = Math.floor((e.clientY - rect.top) / viewState.scale);
    if (x < 0 || x >= currentGridSize || y < 0 || y >= currentGridSize) return;

    const color = document.getElementById('colorPicker').value;
    const size = parseInt(document.getElementById('penSize').value);
    
    if (currentTool === 'pen') {
        ctx.fillStyle = color; ctx.globalCompositeOperation = 'source-over';
        ctx.fillRect(x - Math.floor(size/2), y - Math.floor(size/2), size, size);
    } else if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillRect(x - Math.floor(size/2), y - Math.floor(size/2), size, size);
    } else if (currentTool === 'bucket' && e.type === 'pointerdown') {
        floodFill(x, y, color);
    }
}

function floodFill(startX, startY, fillColor) {
    const img = ctx.getImageData(0, 0, currentGridSize, currentGridSize);
    const target = getPixel(img, startX, startY);
    const rgb = hexToRgb(fillColor);
    if (target[0] === rgb[0] && target[1] === rgb[1] && target[2] === rgb[2] && target[3] === 255) return;
    const stack = [[startX, startY]];
    while (stack.length > 0) {
        const [x, y] = stack.pop();
        const cur = getPixel(img, x, y);
        if (cur[0]===target[0] && cur[1]===target[1] && cur[2]===target[2] && cur[3]===target[3]) {
            setPixel(img, x, y, rgb);
            if (x > 0) stack.push([x - 1, y]);
            if (x < currentGridSize - 1) stack.push([x + 1, y]);
            if (y > 0) stack.push([x, y - 1]);
            if (y < currentGridSize - 1) stack.push([x, y + 1]);
        }
    }
    ctx.putImageData(img, 0, 0);
}
function getPixel(img, x, y) { const i = (y * img.width + x) * 4; return [img.data[i], img.data[i+1], img.data[i+2], img.data[i+3]]; }
function setPixel(img, x, y, rgb) { const i = (y * img.width + x) * 4; img.data[i]=rgb[0]; img.data[i+1]=rgb[1]; img.data[i+2]=rgb[2]; img.data[i+3]=255; }
function hexToRgb(hex) { return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]; }

function setTool(t) { currentTool = t; document.querySelectorAll('#tool-panel button').forEach(b => b.classList.remove('active')); document.getElementById('tool-'+t).classList.add('active'); }
function clearCanvas() { if(confirm("消去しますか？")) ctx.clearRect(0, 0, canvas.width, canvas.height); }

document.getElementById('btn-save-monster').onclick = () => {
    const dataUrl = canvas.toDataURL();
    if (editingMonsterId !== null) {
        const m = monsters.find(m => m.id === editingMonsterId);
        if (m) { m.image = dataUrl; m.size = currentGridSize; }
    } else {
        if (monsters.length >= MAX_MONSTERS) return alert("上限です");
        monsters.push({ id: Date.now(), image: dataUrl, size: currentGridSize, level: 1, points: 1, params: { power: 1, speed: 1, hp: 1, intel: 1 }, trait: null, inParty: false });
    }
    saveAndRefresh();
    spawnMonstersInField();
    goToField();
};

function renderMonsterList() {
    const listCont = document.getElementById('monster-list');
    listCont.innerHTML = '';
    document.getElementById('monster-count').textContent = `(${monsters.length}/${MAX_MONSTERS})`;
    document.getElementById('create-new-area').style.display = monsters.length >= MAX_MONSTERS ? 'none' : 'block';

    monsters.forEach((m, i) => {
        const item = document.createElement('div');
        item.className = 'book-item';
        if (m.inParty) item.style.borderColor = '#4a90e2';

        item.innerHTML = `
            <div class="item-main">
                <input type="checkbox" ${m.inParty?'checked':''} onchange="toggleParty(${m.id})" style="width:20px; height:20px;">
                <img src="${m.image}" style="width:60px; height:60px; image-rendering:pixelated;">
                <div style="flex:1"><strong>No.${i+1} (Lv.${m.level})</strong><br>残り: <b style="color:red;">${m.points}pt</b></div>
                <button onclick="editMonster(${m.id})">描く</button>
                <button onclick="deleteMonster(${m.id})" style="background:#ff6b6b; color:white;">別れ</button>
            </div>
            <div style="margin-top:10px; font-size:12px; background:#eee; padding:5px;">
                攻: ${m.params.power} <button onclick="addParam(${m.id},'power')">＋</button> | 
                速: ${m.params.speed} <button onclick="addParam(${m.id},'speed')">＋</button> | 
                体: ${m.params.hp} <button onclick="addParam(${m.id},'hp')">＋</button> | 
                知: ${m.params.intel} <button onclick="addParam(${m.id},'intel')">＋</button>
                <div style="margin-top:5px;">特性: <select onchange="changeTrait(${m.id},this.value)">
                    <option value="">なし</option><option value="毒" ${m.trait==='毒'?'selected':''}>毒</option>
                    <option value="マヒ" ${m.trait==='マヒ'?'selected':''}>マヒ</option><option value="眠り" ${m.trait==='眠り'?'selected':''}>眠り</option>
                </select>
                <button onclick="resetParams(${m.id})" style="float:right; font-size:10px;">振り直し</button></div>
            </div>
        `;
        listCont.appendChild(item);
    });
}

function toggleParty(id) {
    const m = monsters.find(m => m.id === id);
    if (!m.inParty && monsters.filter(mon => mon.inParty).length >= MAX_PARTY) { alert("3体までです"); renderMonsterList(); return; }
    m.inParty = !m.inParty; saveAndRefresh();
}

function addParam(id, k) {
    const m = monsters.find(m => m.id === id);
    if (m && m.points > 0) { m.params[k]++; m.points--; if(window.gameAudio) { window.gameAudio.sePoint.currentTime=0; window.gameAudio.sePoint.play().catch(()=>{}); } saveAndRefresh(); }
}

function resetParams(id) {
    const m = monsters.find(m => m.id === id);
    if (m && confirm("リセットしますか？")) { m.points = m.level; m.params = { power: 1, speed: 1, hp: 1, intel: 1 }; m.trait = null; saveAndRefresh(); }
}

function changeTrait(id, v) {
    const m = monsters.find(m => m.id === id);
    if (v === "") { m.trait = null; } else if (m.points >= 5) { m.trait = v; m.points -= 5; } else { alert("5pt必要です"); }
    saveAndRefresh();
}

function deleteMonster(id) { if(confirm("削除しますか？")) { monsters = monsters.filter(m => m.id !== id); saveAndRefresh(); spawnMonstersInField(); } }
function saveAndRefresh() { localStorage.setItem('dot_monsters', JSON.stringify(monsters)); renderMonsterList(); }
function editMonster(id) { editingMonsterId = id; const m = monsters.find(m => m.id === id); currentGridSize = m.size; initCanvas(); const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = m.image; closeBookModal(); goToEditor(); setTimeout(resetView, 100); }
function createNewMonster() { editingMonsterId = null; initCanvas(); ctx.clearRect(0,0,canvas.width,canvas.height); closeBookModal(); goToEditor(); setTimeout(resetView, 100); }

function goToField() { 
    document.getElementById('editor-view').style.display='none'; 
    document.getElementById('field-view').style.display='block'; 
    updateGameMusic(); 
}
function goToEditor() { 
    document.getElementById('field-view').style.display='none'; 
    document.getElementById('editor-view').style.display='flex'; 
    updateGameMusic();
}
function openBookModal() { renderMonsterList(); document.getElementById('book-modal').style.display='flex'; }
function closeBookModal() { document.getElementById('book-modal').style.display='none'; }

function spawnMonstersInField() {
    const area = document.getElementById('monster-field-area'); 
    if (!area) return;
    area.innerHTML = '';
    monsters.forEach(m => {
        const img = document.createElement('img'); img.src = m.image; img.className = 'monster';
        img.style.left = (20 + Math.random() * 60) + '%'; 
        img.style.top = (30 + Math.random() * 50) + '%';
        img.style.width = (m.size * 2) + 'px'; 
        area.appendChild(img); 
        animateMonster(img);
    });
}
function animateMonster(el) {
    let a = Math.random() * Math.PI * 2;
    function step() { if(!document.body.contains(el)) return; a += 0.02; el.style.transform = `translate(-50%, calc(-50% - ${Math.abs(Math.sin(a))*10}px))`; requestAnimationFrame(step); }
    requestAnimationFrame(step);
}

// --- バトルシステム ---
let currentFloor = 1, battleActive = false, playerParty = [], enemyParty = [];
let battleSpeed = 1;

function openFloorSelect() {
    const party = monsters.filter(m => m.inParty);
    if (party.length === 0) return alert("パーティを選んでください（最大3体）");
    
    const select = document.getElementById('floor-select-dropdown');
    select.innerHTML = '';
    
    for (let i = 1; i <= Math.max(1, maxClearedFloor); i++) {
        const opt = document.createElement('option');
        opt.value = i; opt.textContent = `${i} 階`;
        select.appendChild(opt);
    }
    const nextOpt = document.createElement('option');
    nextOpt.value = Math.max(1, maxClearedFloor + 1);
    nextOpt.textContent = `${nextOpt.value} 階 (最新)`;
    select.appendChild(nextOpt);
    select.value = nextOpt.value;

    document.getElementById('floor-modal').style.display = 'flex';
}

function confirmFloorAndStart() {
    currentFloor = parseInt(document.getElementById('floor-select-dropdown').value);
    document.getElementById('floor-modal').style.display = 'none';
    startDungeon(currentFloor);
}

function startDungeon(floor = 1) {
    currentFloor = floor;
    document.getElementById('battle-screen').style.display = 'block'; 
    setupBattle();
    updateGameMusic();
}

function toggleBattleSpeed() {
    battleSpeed = (battleSpeed === 1) ? 2 : 1;
    document.getElementById('btn-speed-toggle').textContent = `倍速:${battleSpeed}x`;
}

function setupBattle() {
    const isBoss = (currentFloor % 10 === 0);
    const enemyLv = isBoss ? Math.floor(currentFloor * 1.5) : currentFloor;
    document.getElementById('floor-indicator').textContent = `${currentFloor}階 ${isBoss ? '[BOSS]' : ''}`;
    document.getElementById('battle-log').innerHTML = '';
    document.getElementById('btn-next-floor').style.display = 'none';

    playerParty = monsters.filter(m => m.inParty).map(m => ({ ...m, curHp: m.params.hp * 10, maxHp: m.params.hp * 10, side: 'p', name: '仲間', state: null }));
    enemyParty = [];
    const count = isBoss ? 1 : 3;
    for (let i = 0; i < count; i++) {
        const imgName = isBoss ? BOSS_IMAGE : ENEMY_IMAGES[Math.floor(Math.random() * ENEMY_IMAGES.length)];
        const mult = isBoss ? 3 : 1; 
        enemyParty.push({ 
            id: Math.random(), 
            image: imgName, 
            name: imgName.replace('.png', ''), 
            params: { power: enemyLv * mult, speed: enemyLv * mult, hp: enemyLv * mult, intel: 0 }, 
            curHp: (enemyLv * mult) * 10, maxHp: (enemyLv * mult) * 10, side: 'e', isBoss: isBoss,
            state: null, trait: isBoss ? null : ['毒', 'マヒ', '眠り', '混乱'][Math.floor(Math.random() * 4)]
        });
    }
    battleActive = true; renderBattleUnits(); runTurn();
}

async function runTurn() {
    while (battleActive) {
        let actors = [...playerParty, ...enemyParty].filter(u => u.curHp > 0).sort((a,b) => b.params.speed - a.params.speed);
        for (let u of actors) {
            if (u.curHp <= 0 || !battleActive) continue;
            
            await new Promise(r => setTimeout(r, 800 / battleSpeed));
            
            // 状態異常判定（行動前）
            if (u.state === '眠り') {
                if (Math.random() < 0.7) { u.state = null; addLog(`${u.name}は目が覚めた`); }
                else { addLog(`${u.name}は眠っている...`); continue; }
            }
            if (u.state === 'マヒ' && Math.random() < 0.2) { addLog(`${u.name}は痺れて動けない！`); continue; }

            let targets = (u.side === 'p' ? enemyParty : playerParty).filter(t => t.curHp > 0);
            if (u.state === '混乱') targets = [...playerParty, ...enemyParty].filter(t => t.curHp > 0);
            if (targets.length === 0) break;
            let target = targets[Math.floor(Math.random() * targets.length)];
            
            if (Math.random() * 100 < target.params.speed && u.side === 'e') {
                addLog(`${u.name}の攻撃！ ...回避された`);
            } else {
                let dmg = u.params.power;
                
                let isCrit = Math.random() * 100 < (u.params.intel || 0);
                if (isCrit) {
                    dmg *= 2;
                    addLog(`<b style="color:orange;">💥クリティカル！</b> ${u.name}の強撃！`);
                } else {
                    addLog(`${u.name}の攻撃！`);
                }

                target.curHp -= dmg;
                addLog(`${target.name}に${dmg}ダメ`);
                
                if(window.playBattleAnimation) window.playBattleAnimation(u, target);

                // 状態異常判定（攻撃後付与）
                if (u.trait && !target.isBoss) {
                    if (u.trait === '毒') { target.curHp -= 2; addLog(`${target.name}に毒ダメージ！`); }
                    if (u.trait === 'マヒ' && !target.state) { target.state = 'マヒ'; addLog(`${target.name}をマヒさせた！`); }
                    if (u.trait === '眠り' && !target.state && Math.random() < 0.2) { target.state = '眠り'; addLog(`${target.name}を眠らせた！`); }
                    if (u.trait === '混乱' && !target.state) { target.state = '混乱'; addLog(`${target.name}を混乱させた！`); }
                }
                if (target.state === '眠り' && Math.random() < 0.7) { target.state = null; addLog(`衝撃で${target.name}の目が覚めた！`); }
            }
            renderBattleUnits();
            if (checkEnd()) return;
        }
    }
}

function checkEnd() {
    if (enemyParty.every(e => e.curHp <= 0)) {
        battleActive = false; addLog("勝利！全員LvUP & 1pt獲得！");
        
        if (currentFloor > maxClearedFloor) {
            maxClearedFloor = currentFloor;
            localStorage.setItem('dot_max_cleared', maxClearedFloor);
        }

        monsters.forEach(m => { if(m.inParty) { m.level++; m.points++; } });
        saveAndRefresh(); document.getElementById('btn-next-floor').style.display = 'block'; return true;
    }
    if (playerParty.every(p => p.curHp <= 0)) { battleActive = false; addLog("全滅..."); return true; }
    return false;
}

function nextFloor() { currentFloor++; setupBattle(); updateGameMusic(); }
function exitDungeon() { battleActive = false; document.getElementById('battle-screen').style.display = 'none'; updateGameMusic(); }
function addLog(m) { const l = document.getElementById('battle-log'); l.innerHTML += `<div>${m}</div>`; l.scrollTop = l.scrollHeight; }

function renderBattleUnits() {
    const layer = document.getElementById('battle-unit-layer'); layer.innerHTML = '';
    [...playerParty, ...enemyParty].forEach((u, i) => {
        if (u.curHp <= 0) return;
        const div = document.createElement('div');
        div.id = 'unit-' + String(u.id).replace('.','');
        div.style = `position:absolute; left:${u.side=='p'?'25%':'75%'}; top:${30 + (i%3)*20}%; text-align:center; transform:translate(-50%,-50%);`;
        div.innerHTML = `
            <div style="color:white; font-size:12px; text-shadow:1px 1px 2px black; margin-bottom:2px;">${u.name}</div>
            <div style="width:40px; height:4px; background:red; margin:auto; border:1px solid #000;">
                <div style="width:${(u.curHp/u.maxHp)*100}%; height:100%; background:lime;"></div>
            </div>
            <div style="color:yellow; font-size:10px; text-shadow:1px 1px 1px black; height:12px; margin-top:2px;">${u.state || ''}</div>
            <img src="${u.image}" style="width:80px; image-rendering:pixelated; ${u.side=='e'?'transform: scaleX(-1);':''}">
        `;
        layer.appendChild(div);
    });
}

// 戦闘アニメーション関数
window.playBattleAnimation = (attacker, target) => {
    const atkEl = document.getElementById('unit-' + String(attacker.id).replace('.',''));
    const tgtEl = document.getElementById('unit-' + String(target.id).replace('.',''));
    if (atkEl) {
        atkEl.classList.remove('anim-attack'); void atkEl.offsetWidth; atkEl.classList.add('anim-attack');
    }
    if (tgtEl) {
        const dmgClass = target.side === 'p' ? 'anim-damage-p' : 'anim-damage-e';
        tgtEl.classList.remove('anim-damage-p', 'anim-damage-e'); void tgtEl.offsetWidth; tgtEl.classList.add(dmgClass);
    }
};

// --- オーディオ設定 ---
window.gameAudio = {
    field: new Audio('so_sweet.mp3'), battle: new Audio('Quick_pipes.mp3'), boss: new Audio('Battle_in_the_Moonlight.mp3'), sePoint: new Audio('point.mp3')
};
let volBGM = 0.08, volSE = 0.5;
const allBGM = [window.gameAudio.field, window.gameAudio.battle, window.gameAudio.boss];
allBGM.forEach(s => { s.loop = true; s.volume = volBGM; });

document.getElementById('settings-btn').onclick = () => document.getElementById('settings-modal').style.display = 'flex';
document.getElementById('bgm-slider').oninput = (e) => { volBGM = e.target.value; allBGM.forEach(s => s.volume = volBGM); };
document.getElementById('se-slider').oninput = (e) => { volSE = e.target.value; window.gameAudio.sePoint.volume = volSE; };

function updateGameMusic() {
    allBGM.forEach(s => s.pause());
    const editorVisible = document.getElementById('editor-view').style.display === 'flex';
    const battleVisible = document.getElementById('battle-screen').style.display === 'block';
    if (editorVisible) return;
    if (battleVisible) {
        if (currentFloor % 10 === 0) window.gameAudio.boss.play().catch(()=>{});
        else window.gameAudio.battle.play().catch(()=>{});
    } else {
        window.gameAudio.field.play().catch(()=>{});
    }
}

document.addEventListener('click', () => {
    updateGameMusic();
}, { once: false });
