let monsters = [];
let inventory = [];
let editingMonsterId = null;
const MAX_MONSTERS = 5; 
const MAX_PARTY = 3;    

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
        monsters.forEach(m => {
            if (!m.equips) m.equips = [null, null];
            if (m.extraSlotUnlocked === undefined) m.extraSlotUnlocked = false;
        });
    }
    const savedInv = localStorage.getItem('dot_inventory');
    if (savedInv) {
        inventory = JSON.parse(savedInv);
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
        monsters.push({ id: Date.now(), name: 'ななし', image: dataUrl, size: currentGridSize, level: 1, points: 5, params: { power: 1, speed: 1, hp: 1, intel: 1 }, trait: null, passives: [], inParty: false, equips: [null, null], extraSlotUnlocked: false });
    }
    saveAndRefresh();
    spawnMonstersInField();
    goToField();
};

function getEquipStats(m) {
    let b = { power: 0, speed: 0, hp: 0, intel: 0 };
    if (!m.equips) return b;
    m.equips.forEach(ringId => {
        if (!ringId) return;
        const ring = inventory.find(r => r.id === ringId);
        if (ring) b[ring.type] += ring.val;
    });
    return b;
}

function getTotalStats(m) {
    let b = getEquipStats(m);
    return {
        power: m.params.power + b.power,
        speed: m.params.speed + b.speed,
        hp: m.params.hp + b.hp,
        intel: m.params.intel + b.intel
    };
}

function renderEquipSelect(m, slotIndex) {
    let currentRing = null;
    if (m.equips && m.equips[slotIndex]) {
        currentRing = inventory.find(r => r.id === m.equips[slotIndex]);
    }
    let imgHtml = '';
    if (currentRing) {
        let fileName = {power:'力の指輪.png', speed:'速度の指輪.png', hp:'体力の指輪.png', intel:'知力の指輪.png'}[currentRing.type];
        imgHtml = `<img src="${fileName}" style="width:16px; height:16px; vertical-align:middle; image-rendering:pixelated; margin-right:4px;">`;
    }

    let html = `${imgHtml}<select onchange="changeEquip(${m.id}, ${slotIndex}, this.value)" style="font-size:11px; vertical-align:middle;">
        <option value="">なし</option>`;
    inventory.forEach(ring => {
        let equippedByOther = monsters.find(mon => mon.id !== m.id && mon.equips && mon.equips.includes(ring.id));
        if (equippedByOther) return;
        if (m.equips[1 - slotIndex] === ring.id) return;
        let typeName = {power:'力', speed:'速度', hp:'体力', intel:'知力'}[ring.type] + 'の指輪';
        let selected = m.equips[slotIndex] === ring.id ? 'selected' : '';
        html += `<option value="${ring.id}" ${selected}>${typeName}(+${ring.val})</option>`;
    });
    html += `</select>`;
    return html;
}

function changeEquip(mId, slotIndex, ringIdStr) {
    const m = monsters.find(m => m.id === mId);
    if (!m) return;
    if (!m.equips) m.equips = [null, null];
    m.equips[slotIndex] = ringIdStr ? parseFloat(ringIdStr) : null;
    saveAndRefresh();
}

function unlockExtraSlot(mId) {
    const m = monsters.find(m => m.id === mId);
    if (!m) return;
    if (m.points < 50) return alert("50pt必要です");
    m.points -= 50;
    m.extraSlotUnlocked = true;
    if(window.gameAudio) { window.gameAudio.sePoint.currentTime=0; window.gameAudio.sePoint.play().catch(()=>{}); }
    saveAndRefresh();
}

function renderMonsterList() {
    const listCont = document.getElementById('monster-list');
    listCont.innerHTML = '';
    document.getElementById('monster-count').textContent = `(${monsters.length}/${MAX_MONSTERS})`;
    document.getElementById('create-new-area').style.display = monsters.length >= MAX_MONSTERS ? 'none' : 'block';

    monsters.forEach((m, i) => {
        if (!m.equips) m.equips = [null, null];

        let stats = getTotalStats(m);
        let bonus = getEquipStats(m);
        const sStr = (b, bon) => bon > 0 ? `${b}<span style="color:#4a90e2;font-size:10px;">(+${bon})</span>` : `${b}`;

        let equipHtml = `装備1: ${renderEquipSelect(m, 0)}`;
        if (m.extraSlotUnlocked) {
            equipHtml += ` | 装備2: ${renderEquipSelect(m, 1)}`;
        } else {
            if (stats.power > 100 && stats.speed > 100 && stats.hp > 100 && stats.intel > 100) {
                equipHtml += ` <button onclick="unlockExtraSlot(${m.id})" style="background:#4a90e2; color:white; border:none; border-radius:3px; font-size:10px; padding:4px;">枠追加(50pt)</button>`;
            }
        }

        const item = document.createElement('div');
        item.className = 'book-item';
        if (m.inParty) item.style.borderColor = '#4a90e2';

        item.innerHTML = `
            <div class="item-main">
                <input type="checkbox" ${m.inParty?'checked':''} onchange="toggleParty(${m.id})" style="width:20px; height:20px;">
                <img src="${m.image}" style="width:60px; height:60px; image-rendering:pixelated;">
                <div style="flex:1">
                    <input type="text" class="name-input" value="${m.name || 'ななし'}" onchange="updateMonsterName(${m.id}, this.value)">
                    <br><small>Lv.${m.level} / 残り: <b style="color:red;">${m.points}pt</b></small>
                </div>
                <button onclick="editMonster(${m.id})">描く</button>
                <button onclick="deleteMonster(${m.id})" style="background:#ff6b6b; color:white;">別れ</button>
            </div>
            <div style="margin-top:10px; font-size:12px; background:#eee; padding:5px;">
                攻: ${sStr(m.params.power, bonus.power)} <button onclick="addParam(${m.id},'power')">＋</button><button onclick="addAllParam(${m.id},'power')" style="font-size:10px; padding:2px 4px;">全</button> | 
                速: ${sStr(m.params.speed, bonus.speed)} <button onclick="addParam(${m.id},'speed')">＋</button><button onclick="addAllParam(${m.id},'speed')" style="font-size:10px; padding:2px 4px;">全</button> | 
                体: ${sStr(m.params.hp, bonus.hp)} <button onclick="addParam(${m.id},'hp')">＋</button><button onclick="addAllParam(${m.id},'hp')" style="font-size:10px; padding:2px 4px;">全</button> | 
                知: ${sStr(m.params.intel, bonus.intel)} <button onclick="addParam(${m.id},'intel')">＋</button><button onclick="addAllParam(${m.id},'intel')" style="font-size:10px; padding:2px 4px;">全</button>
                <div style="margin-top:5px;">特性: <select onchange="changeTrait(${m.id},this.value)">
                    <option value="">なし</option><option value="毒" ${m.trait==='毒'?'selected':''}>毒</option>
                    <option value="マヒ" ${m.trait==='マヒ'?'selected':''}>マヒ</option><option value="眠り" ${m.trait==='眠り'?'selected':''}>眠り</option>
                    <option value="混乱" ${m.trait==='混乱'?'selected':''}>混乱</option>
                </select>
                <button onclick="resetParams(${m.id})" style="float:right; font-size:10px;">振り直し</button></div>
                <div style="margin-top:5px; padding-top:5px; border-top:1px dashed #ccc;">パッシブ: 
                    <select id="passive-select-${m.id}">
                        <option value="全体攻撃">全体攻撃</option>
                        <option value="連続攻撃">連続攻撃</option>
                        <option value="庇う">庇う</option>
                        <option value="自己再生">自己再生</option>
                        <option value="状態異常無効">状態異常無効</option>
                        <option value="限界突破">限界突破</option>
                    </select>
                    <button onclick="addPassive(${m.id})">習得</button>
                    <span style="font-size:11px; color:#555;">(習得済: ${(m.passives||[]).join(', ') || 'なし'})</span>
                </div>
                <div style="margin-top:5px; padding-top:5px; border-top:1px dashed #ccc;">
                    ${equipHtml}
                </div>
            </div>
        `;
        listCont.appendChild(item);
    });
}

function updateMonsterName(id, val) {
    const m = monsters.find(m => m.id === id);
    if (m) { m.name = val; saveAndRefresh(); }
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

function addAllParam(id, k) {
    const m = monsters.find(m => m.id === id);
    if (m && m.points > 0) {
        m.params[k] += m.points;
        m.points = 0;
        if(window.gameAudio) { window.gameAudio.sePoint.currentTime=0; window.gameAudio.sePoint.play().catch(()=>{}); }
        saveAndRefresh();
    }
}

function resetParams(id) {
    const m = monsters.find(m => m.id === id);
    if (m && confirm("リセットしますか？")) { m.points = m.level + 4; m.params = { power: 1, speed: 1, hp: 1, intel: 1 }; m.trait = null; m.passives = []; saveAndRefresh(); }
}

function changeTrait(id, v) {
    const m = monsters.find(m => m.id === id);
    if (v === "") { m.trait = null; } else if (m.points >= 5) { m.trait = v; m.points -= 5; } else { alert("5pt必要です"); }
    saveAndRefresh();
}

function addPassive(id) {
    const m = monsters.find(m => m.id === id);
    if (!m) return;
    if (!m.passives) m.passives = [];
    
    if (m.passives.length >= 2) {
        alert("パッシブは2つまでです");
        return;
    }
    
    const sel = document.getElementById(`passive-select-${id}`);
    const val = sel.value;
    
    if (m.passives.includes(val)) {
        alert("既に習得しています");
        return;
    }
    
    const cost = m.passives.length === 0 ? 15 : 30;
    if (m.points < cost) {
        alert(`${cost}pt必要です`);
        return;
    }
    
    m.points -= cost;
    m.passives.push(val);
    if(window.gameAudio) { window.gameAudio.sePoint.currentTime=0; window.gameAudio.sePoint.play().catch(()=>{}); }
    saveAndRefresh();
}

function deleteMonster(id) { if(confirm("削除しますか？")) { monsters = monsters.filter(m => m.id !== id); saveAndRefresh(); spawnMonstersInField(); } }
function saveAndRefresh() { 
    localStorage.setItem('dot_monsters', JSON.stringify(monsters)); 
    localStorage.setItem('dot_inventory', JSON.stringify(inventory));
    renderMonsterList(); 
}
function editMonster(id) { editingMonsterId = id; const m = monsters.find(m => m.id === id); currentGridSize = m.size; initCanvas(); const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = m.image; closeBookModal(); goToEditor(); setTimeout(resetView, 100); }
function createNewMonster() { editingMonsterId = null; initCanvas(); ctx.clearRect(0,0,canvas.width,canvas.height); closeBookModal(); goToEditor(); setTimeout(resetView, 100); }

function goToField() { document.getElementById('editor-view').style.display='none'; document.getElementById('field-view').style.display='block'; updateGameMusic(); }
function goToEditor() { document.getElementById('field-view').style.display='none'; document.getElementById('editor-view').style.display='flex'; updateGameMusic(); }
function openBookModal() { renderMonsterList(); document.getElementById('book-modal').style.display='flex'; }
function closeBookModal() { document.getElementById('book-modal').style.display='none'; }

function spawnMonstersInField() {
    const area = document.getElementById('monster-field-area'); if (!area) return;
    area.innerHTML = '';
    monsters.forEach(m => {
        const img = document.createElement('img'); img.src = m.image; img.className = 'monster';
        img.style.left = (20 + Math.random() * 60) + '%'; img.style.top = (30 + Math.random() * 50) + '%';
        img.style.width = (m.size * 2) + 'px'; area.appendChild(img); animateMonster(img);
    });
}
function animateMonster(el) {
    let a = Math.random() * Math.PI * 2;
    function step() { if(!document.body.contains(el)) return; a += 0.02; el.style.transform = `translate(-50%, calc(-50% - ${Math.abs(Math.sin(a))*10}px))`; requestAnimationFrame(step); }
    requestAnimationFrame(step);
}

function resetData() {
    if (confirm("すべてのデータを削除して最初からやり直しますか？")) {
        localStorage.clear();
        location.reload();
    }
}

let currentFloor = 1, battleActive = false, playerParty = [], enemyParty = [];
let battleSpeed = 1;
let isBossRushMode = false;

function openFloorSelect() {
    const party = monsters.filter(m => m.inParty);
    if (party.length === 0) return alert("パーティを選んでください（最大3体）");
    
    const checkbox = document.getElementById('boss-mode-checkbox');
    if(checkbox) checkbox.checked = false;
    
    updateFloorDropdown();
    document.getElementById('floor-modal').style.display = 'flex';
}

function updateFloorDropdown() {
    const select = document.getElementById('floor-select-dropdown'); 
    select.innerHTML = '';
    let maxAvailable = Math.min(100, Math.max(1, maxClearedFloor + 1));
    let bossMode = document.getElementById('boss-mode-checkbox') ? document.getElementById('boss-mode-checkbox').checked : false;

    if (bossMode) {
        for (let i = 10; i <= maxAvailable; i += 10) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `${i} 階 (BOSS)`;
            select.appendChild(opt);
        }
        if (maxClearedFloor >= 100) {
            const opt = document.createElement('option');
            opt.value = 101;
            opt.textContent = `EXステージ (神竜×3)`;
            select.appendChild(opt);
        }
        if (select.options.length === 0) {
            const opt = document.createElement('option');
            opt.value = "";
            opt.textContent = "選択可能ボスなし";
            select.appendChild(opt);
        }
    } else {
        for (let i = 1; i <= maxAvailable; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = i === maxAvailable && i > maxClearedFloor ? `${i} 階 (最新)` : `${i} 階`;
            select.appendChild(opt);
        }
        if (maxClearedFloor >= 100) {
            const opt = document.createElement('option');
            opt.value = 101;
            opt.textContent = `EXステージ (神竜×3)`;
            select.appendChild(opt);
        }
        select.value = maxAvailable;
    }
}

function confirmFloorAndStart() {
    const val = document.getElementById('floor-select-dropdown').value;
    if (!val) return alert("選択できる階層がありません");
    currentFloor = parseInt(val);
    isBossRushMode = document.getElementById('boss-mode-checkbox') ? document.getElementById('boss-mode-checkbox').checked : false;
    document.getElementById('floor-modal').style.display = 'none';
    startDungeon(currentFloor);
}

function startDungeon(floor = 1) {
    currentFloor = floor;
    document.getElementById('battle-screen').style.display = 'block'; setupBattle(); updateGameMusic();
}

function toggleBattleSpeed() {
    battleSpeed = (battleSpeed === 1) ? 2 : 1;
    document.getElementById('btn-speed-toggle').textContent = `倍速:${battleSpeed}x`;
}

function setupBattle() {
    const isEX = (currentFloor === 101);
    const isBoss = (currentFloor % 10 === 0 && currentFloor <= 100);
    const enemyLv = isEX ? 150 : (isBoss ? Math.floor(currentFloor * 1.5) : currentFloor);
    document.getElementById('floor-indicator').textContent = isEX ? `EXステージ` : `${currentFloor}階 ${isBoss ? '[BOSS]' : ''}`;
    document.getElementById('battle-log').innerHTML = '';
    document.getElementById('btn-next-floor').style.display = 'none';

    playerParty = monsters.filter(m => m.inParty).map(m => {
        let t = getTotalStats(m);
        return {
            ...m, 
            params: t, 
            curHp: t.hp * 10, 
            maxHp: t.hp * 10, 
            side: 'p', 
            name: m.name || '仲間', 
            state: null, 
            passives: m.passives || [], 
            breakCharge: false 
        };
    });
    
    enemyParty = [];
    const count = isEX ? 3 : (isBoss ? 1 : 3);
    for (let i = 0; i < count; i++) {
        const imgName = (isBoss || isEX) ? BOSS_IMAGE : ENEMY_IMAGES[Math.floor(Math.random() * ENEMY_IMAGES.length)];
        const mult = (isBoss || isEX) ? 3 : 1; 
        let eName = imgName.replace('.png', '');
        if (isEX) eName += ` ${['A','B','C'][i]}`;

        enemyParty.push({ 
            id: Math.random(), image: imgName, name: eName, 
            params: { power: enemyLv * mult, speed: enemyLv * mult, hp: enemyLv * mult, intel: 0 }, 
            curHp: (enemyLv * mult) * 10, maxHp: (enemyLv * mult) * 10, side: 'e', isBoss: (isBoss || isEX),
            state: null, trait: (isBoss || isEX) ? null : ['毒', 'マヒ', '眠り', '混乱'][Math.floor(Math.random() * 4)],
            passives: [], breakCharge: false
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
            
            if (u.state === '眠り') {
                if (Math.random() < 0.3) { u.state = null; addLog(`${u.name}は目が覚めた`); }
                else { addLog(`${u.name}は眠っている...`); continue; }
            }
            if (u.state === 'マヒ' && Math.random() < 0.25) { addLog(`${u.name}は体が痺れて動けない！`); continue; }

            if (u.passives && u.passives.includes('自己再生') && u.curHp < u.maxHp) {
                let heal = Math.floor(u.maxHp * 0.1);
                if (heal < 1) heal = 1;
                u.curHp = Math.min(u.maxHp, u.curHp + heal);
                addLog(`${u.name}は自己再生で${heal}回復！`);
                renderBattleUnits();
            }

            let dmgMult = 1;
            if (u.passives && u.passives.includes('限界突破')) {
                if (!u.breakCharge) {
                    u.breakCharge = true;
                    addLog(`${u.name}は限界突破の力を溜めている！`);
                    continue;
                } else {
                    u.breakCharge = false;
                    dmgMult = 2.5;
                }
            }

            let targets = (u.side === 'p' ? enemyParty : playerParty).filter(t => t.curHp > 0);
            if (u.state === '混乱') targets = [...playerParty, ...enemyParty].filter(t => t.curHp > 0);
            if (targets.length === 0) break;

            let animatedAttacker = null;
            let animatedTargets = [];

            if (u.isBoss && Math.random() < 0.25) {
                addLog(`<b style="color:red;">ドラゴンの全体攻撃！</b>`);
                animatedAttacker = u;
                for (let target of targets) {
                    let dmg = Math.floor(u.params.power * 0.7);
                    target.curHp -= dmg;
                    addLog(`${target.name}に${dmg}ダメ`);
                    animatedTargets.push(target);
                }
            } else {
                let isAllAttack = (u.passives && u.passives.includes('全体攻撃') && Math.random() < 0.5);
                animatedAttacker = u;

                if (isAllAttack) {
                    addLog(`${u.name}の全体攻撃！`);
                    for (let target of targets) {
                        let evadeProb = Math.max(0, target.params.speed - u.params.speed);
                        if (Math.random() * 100 < evadeProb) {
                            addLog(`${u.name}の攻撃！ ...${target.name}は回避した！`);
                        } else {
                            let dmg = u.params.power;
                            let isCrit = Math.random() * 100 < (u.params.intel || 0);
                            if (isCrit) { dmg *= 2; addLog(`<b style="color:orange;">💥クリティカル！</b>`); }
                            
                            dmg = Math.floor(dmg * dmgMult);
                            target.curHp -= dmg;
                            addLog(`${target.name}に${dmg}ダメ`);
                            animatedTargets.push(target);

                            if (u.trait && !target.isBoss) {
                                if (target.passives && target.passives.includes('状態異常無効') && Math.random() < 0.5) {
                                    addLog(`${target.name}は状態異常を無効化した！`);
                                } else {
                                    if (u.trait === '毒') { 
                                        let pDmg = Math.floor(dmg * 0.3);
                                        if(pDmg < 1) pDmg = 1;
                                        target.curHp -= pDmg; 
                                        addLog(`${target.name}に毒の追加ダメージ${pDmg}！`); 
                                    }
                                    if (u.trait === 'マヒ' && !target.state && Math.random() < 0.3) { target.state = 'マヒ'; addLog(`${target.name}をマヒさせた！`); }
                                    if (u.trait === '眠り' && !target.state && Math.random() < 0.2) { target.state = '眠り'; addLog(`${target.name}を眠らせた！`); }
                                    if (u.trait === '混乱' && !target.state && Math.random() < 0.3) { target.state = '混乱'; addLog(`${target.name}を混乱させた！`); }
                                }
                            }
                            if (target.state === '眠り' && Math.random() < 0.5) { target.state = null; addLog(`衝撃で${target.name}の目が覚めた！`); }
                        }
                    }
                } else {
                    let target = targets[Math.floor(Math.random() * targets.length)];
                    
                    let kabauUnit = targets.find(t => t.passives && t.passives.includes('庇う') && t.id !== target.id);
                    if (kabauUnit && Math.random() < 0.7) {
                        addLog(`${kabauUnit.name}が${target.name}を庇った！`);
                        target = kabauUnit;
                    }

                    let atkCount = 1;
                    if (u.passives && u.passives.includes('連続攻撃') && u.params.speed >= target.params.speed * 1.5) {
                        atkCount = 2;
                    }

                    for (let i = 0; i < atkCount; i++) {
                        if (target.curHp <= 0) break;
                        
                        let evadeProb = Math.max(0, target.params.speed - u.params.speed);
                        if (Math.random() * 100 < evadeProb) {
                            addLog(`${u.name}の攻撃！ ...${target.name}は回避した！`);
                        } else {
                            let dmg = u.params.power;
                            let isCrit = Math.random() * 100 < (u.params.intel || 0);
                            if (isCrit) { dmg *= 2; addLog(`<b style="color:orange;">💥クリティカル！</b> ${u.name}の強撃！`); }
                            else { addLog(`${u.name}の攻撃！`); }

                            dmg = Math.floor(dmg * dmgMult);
                            target.curHp -= dmg;
                            addLog(`${target.name}に${dmg}ダメ`);
                            if (!animatedTargets.includes(target)) animatedTargets.push(target);

                            if (u.trait && !target.isBoss) {
                                if (target.passives && target.passives.includes('状態異常無効') && Math.random() < 0.5) {
                                    addLog(`${target.name}は状態異常を無効化した！`);
                                } else {
                                    if (u.trait === '毒') { 
                                        let pDmg = Math.floor(dmg * 0.3);
                                        if(pDmg < 1) pDmg = 1;
                                        target.curHp -= pDmg; 
                                        addLog(`${target.name}に毒の追加ダメージ${pDmg}！`); 
                                    }
                                    if (u.trait === 'マヒ' && !target.state && Math.random() < 0.3) { target.state = 'マヒ'; addLog(`${target.name}をマヒさせた！`); }
                                    if (u.trait === '眠り' && !target.state && Math.random() < 0.2) { target.state = '眠り'; addLog(`${target.name}を眠らせた！`); }
                                    if (u.trait === '混乱' && !target.state && Math.random() < 0.3) { target.state = '混乱'; addLog(`${target.name}を混乱させた！`); }
                                }
                            }
                            if (target.state === '眠り' && Math.random() < 0.5) { target.state = null; addLog(`衝撃で${target.name}の目が覚めた！`); }
                        }
                    }
                }
            }
            
            renderBattleUnits();
            
            if (animatedAttacker) {
                playBattleAnimation(animatedAttacker, null);
            }
            for (let tgt of animatedTargets) {
                playBattleAnimation(null, tgt);
            }

            if (checkEnd()) return;
        }
    }
}

function checkEnd() {
    if (enemyParty.every(e => e.curHp <= 0)) {
        battleActive = false; addLog("勝利！全員LvUP & 1pt獲得！");
        
        if (currentFloor % 10 === 0 && Math.random() < 0.05) {
            const types = ['power', 'speed', 'hp', 'intel'];
            const t = types[Math.floor(Math.random() * types.length)];
            const ring = { id: Date.now() + Math.random(), type: t, val: currentFloor };
            inventory.push(ring);
            localStorage.setItem('dot_inventory', JSON.stringify(inventory));
            let typeName = {power:'力の指輪', speed:'速度の指輪', hp:'体力の指輪', intel:'知力の指輪'}[t];
            addLog(`<b style="color:yellow;">${typeName}(+${currentFloor})をドロップした！</b>`);
        }

        if (currentFloor > maxClearedFloor && currentFloor <= 100) { maxClearedFloor = currentFloor; localStorage.setItem('dot_max_cleared', maxClearedFloor); }
        monsters.forEach(m => { if(m.inParty) { m.level++; m.points++; } });
        saveAndRefresh(); 

        let maxAvailable = Math.min(100, Math.max(1, maxClearedFloor + 1));
        let nextFloorVal = isBossRushMode ? currentFloor + 10 : currentFloor + 1;

        if (currentFloor === 101) {
            addLog(`<b style="color:gold;">EXステージ完全制覇！おめでとう！</b>`);
            document.getElementById('btn-next-floor').style.display = 'none';
        } else if (currentFloor === 100) {
            document.getElementById('clear-modal').style.display = 'flex';
            document.getElementById('btn-next-floor').style.display = 'none';
        } else if (nextFloorVal > maxAvailable) {
            document.getElementById('btn-next-floor').style.display = 'none';
        } else {
            document.getElementById('btn-next-floor').style.display = 'block'; 
        }
        return true;
    }
    if (playerParty.every(p => p.curHp <= 0)) { battleActive = false; addLog("全滅..."); return true; }
    return false;
}

function nextFloor() { 
    currentFloor = isBossRushMode ? currentFloor + 10 : currentFloor + 1;
    setupBattle(); 
    updateGameMusic(); 
}

function exitDungeon() { battleActive = false; document.getElementById('battle-screen').style.display = 'none'; updateGameMusic(); }
function addLog(m) { const l = document.getElementById('battle-log'); l.innerHTML += `<div>${m}</div>`; l.scrollTop = l.scrollHeight; }

function renderBattleUnits() {
    const layer = document.getElementById('battle-unit-layer'); layer.innerHTML = '';
    [...playerParty, ...enemyParty].forEach((u) => {
        if (u.curHp <= 0) return;
        const idx = (u.side === 'p') ? playerParty.indexOf(u) : enemyParty.indexOf(u);
        const topPos = (u.side === 'p') ? (35 + idx * 22) : (30 + idx * 25);
        const leftPos = (u.side === 'p') ? (25 - (idx % 2) * 5) : (75 + (idx % 2) * 5);

        const div = document.createElement('div');
        div.id = 'unit-' + String(u.id).replace('.','');
        div.style = `position:absolute; left:${leftPos}%; top:${topPos}%; text-align:center; transform:translate(-50%,-50%);`;
        div.innerHTML = `
            <div style="color:white; font-size:12px; text-shadow:1px 1px 2px black;">${u.name}</div>
            <div style="width:50px; height:5px; background:red; margin:5px auto; border:1px solid #000; position:relative;">
                <div style="width:${(u.curHp/u.maxHp)*100}%; height:100%; background:lime;"></div>
            </div>
            <div style="color:yellow; font-size:11px; font-weight:bold; text-shadow:1px 1px 2px black; height:15px;">${u.state || ''}</div>
            <img src="${u.image}" style="width:100px; image-rendering:pixelated; ${u.side=='e'?'transform: scaleX(-1);':''}">
        `;
        layer.appendChild(div);
    });
}

function playBattleAnimation(attacker, target) {
    if (attacker) {
        const atkEl = document.getElementById('unit-' + String(attacker.id).replace('.',''));
        if (atkEl) {
            atkEl.classList.remove('anim-attack');
            void atkEl.offsetWidth;
            atkEl.classList.add('anim-attack');
        }
    }
    if (target) {
        const tgtEl = document.getElementById('unit-' + String(target.id).replace('.',''));
        if (tgtEl) {
            const kbClass = (target.side === 'p') ? 'anim-damage-p' : 'anim-damage-e';
            tgtEl.classList.remove('anim-damage-p', 'anim-damage-e');
            void tgtEl.offsetWidth;
            tgtEl.classList.add(kbClass);
        }
    }
}

window.gameAudio = { field: new Audio('so_sweet.mp3'), battle: new Audio('Quick_pipes.mp3'), boss: new Audio('Battle_in_the_Moonlight.mp3'), sePoint: new Audio('point.mp3') };
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
        if (currentFloor % 10 === 0 || currentFloor === 101) window.gameAudio.boss.play().catch(()=>{});
        else window.gameAudio.battle.play().catch(()=>{});
    } else {
        window.gameAudio.field.play().catch(()=>{});
    }
}
document.addEventListener('click', () => { updateGameMusic(); }, { once: false });
