let monsters = [];
let editingMonsterId = null;
const MAX_MONSTERS = 3;

const canvas = document.getElementById('paintCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const container = document.getElementById('canvas-container');
const statusDisplay = document.getElementById('status-display');
const gridSizeSelect = document.getElementById('gridSize');

let currentGridSize = 32;
let currentTool = 'pen';
let isDrawing = false;
let isPanning = false;

let viewState = {
    scale: 10,
    pointX: 0,
    pointY: 0,
    startX: 0,
    startY: 0,
    panning: false
};

window.onload = () => {
    const saved = localStorage.getItem('dot_monsters');
    if (saved) {
        monsters = JSON.parse(saved);
        renderMonsterList();
        spawnMonstersInField();
    }
    initCanvas();
    resetView();
    setupCanvasEvents();
};

function initCanvas() {
    canvas.width = currentGridSize;
    canvas.height = currentGridSize;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function clearCanvas() {
    if(confirm("すべて消去しますか？")) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function updateTransform() {
    canvas.style.transform = `translate(${viewState.pointX}px, ${viewState.pointY}px) scale(${viewState.scale})`;
    statusDisplay.textContent = `Grid: ${currentGridSize}x${currentGridSize} | Zoom: ${Math.round(viewState.scale * 10)}%`;
}

function zoom(factor) {
    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;
    const dx = cx - viewState.pointX;
    const dy = cy - viewState.pointY;
    viewState.pointX = cx - dx * factor;
    viewState.pointY = cy - dy * factor;
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
    if(confirm("サイズを変更すると現在の絵が消えます。よろしいですか？")) {
        currentGridSize = parseInt(gridSizeSelect.value);
        initCanvas();
        resetView();
    } else {
        gridSizeSelect.value = currentGridSize;
    }
};

function getGridPos(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) / viewState.scale;
    const y = (clientY - rect.top) / viewState.scale;
    return { x: Math.floor(x), y: Math.floor(y) };
}

function setupCanvasEvents() {
    container.onpointerdown = (e) => {
        if (isPanning || e.button === 1) {
            viewState.panning = true;
            viewState.startX = e.clientX - viewState.pointX;
            viewState.startY = e.clientY - viewState.pointY;
            return;
        }
        isDrawing = true;
        execTool(e);
    };
    window.onpointermove = (e) => {
        if (viewState.panning) {
            viewState.pointX = e.clientX - viewState.startX;
            viewState.pointY = e.clientY - viewState.startY;
            updateTransform();
        } else if (isDrawing) {
            execTool(e);
        }
    };
    window.onpointerup = () => { isDrawing = false; viewState.panning = false; };
    container.onwheel = (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 0.9 : 1.1); };
    window.onkeydown = (e) => { if (e.code === 'Space') isPanning = true; };
    window.onkeyup = (e) => { if (e.code === 'Space') isPanning = false; };
}

function execTool(e) {
    const pos = getGridPos(e);
    if (pos.x < 0 || pos.x >= currentGridSize || pos.y < 0 || pos.y >= currentGridSize) return;
    const color = document.getElementById('colorPicker').value;
    const size = parseInt(document.getElementById('penSize').value);
    
    if (currentTool === 'pen') {
        ctx.fillStyle = color;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillRect(pos.x - Math.floor(size/2), pos.y - Math.floor(size/2), size, size);
    } else if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillRect(pos.x - Math.floor(size/2), pos.y - Math.floor(size/2), size, size);
    } else if (currentTool === 'bucket' && e.type === 'pointerdown') {
        floodFill(pos.x, pos.y, color);
    } else if (currentTool === 'picker' && e.type === 'pointerdown') {
        const d = ctx.getImageData(pos.x, pos.y, 1, 1).data;
        if (d[3] > 0) {
            document.getElementById('colorPicker').value = "#" + ((1 << 24) + (d[0] << 16) + (d[1] << 8) + d[2]).toString(16).slice(1);
            setTool('pen');
        }
    }
}

function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('#tool-panel button').forEach(b => b.classList.remove('active'));
    document.getElementById('tool-' + tool).classList.add('active');
}

function floodFill(startX, startY, fillColor) {
    const img = ctx.getImageData(0, 0, currentGridSize, currentGridSize);
    const target = getPixel(img, startX, startY);
    const rgb = hexToRgb(fillColor);
    if (colorsMatch(target, [...rgb, 255])) return;
    const stack = [[startX, startY]];
    while (stack.length > 0) {
        const [x, y] = stack.pop();
        if (colorsMatch(getPixel(img, x, y), target)) {
            setPixel(img, x, y, rgb);
            if (x > 0) stack.push([x - 1, y]);
            if (x < currentGridSize - 1) stack.push([x + 1, y]);
            if (y > 0) stack.push([x, y - 1]);
            if (y < currentGridSize - 1) stack.push([x, y + 1]);
        }
    }
    ctx.putImageData(img, 0, 0);
}

function getPixel(img, x, y) {
    const i = (y * img.width + x) * 4;
    return [img.data[i], img.data[i+1], img.data[i+2], img.data[i+3]];
}
function setPixel(img, x, y, rgb) {
    const i = (y * img.width + x) * 4;
    img.data[i]=rgb[0]; img.data[i+1]=rgb[1]; img.data[i+2]=rgb[2]; img.data[i+3]=255;
}
function colorsMatch(a, b) { return a[0]===b[0] && a[1]===b[1] && a[2]===b[2] && a[3]===b[3]; }
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
}

document.getElementById('btn-save-monster').onclick = () => {
    const dataUrl = canvas.toDataURL();
    if (editingMonsterId !== null) {
        const i = monsters.findIndex(m => m.id === editingMonsterId);
        if (i !== -1) { monsters[i].image = dataUrl; monsters[i].size = currentGridSize; }
    } else {
        if (monsters.length >= MAX_MONSTERS) { alert("3体までです。"); return; }
        monsters.push({ id: Date.now(), image: dataUrl, size: currentGridSize });
    }
    localStorage.setItem('dot_monsters', JSON.stringify(monsters));
    editingMonsterId = null;
    spawnMonstersInField();
    goToField();
};

function renderMonsterList() {
    const cont = document.getElementById('monster-list');
    cont.innerHTML = '';
    document.getElementById('monster-count').textContent = `(${monsters.length}/${MAX_MONSTERS})`;
    document.getElementById('create-new-area').style.display = monsters.length >= MAX_MONSTERS ? 'none' : 'block';
    monsters.forEach((m, i) => {
        const item = document.createElement('div');
        item.className = 'book-item';
        item.innerHTML = `<img src="${m.image}"><div class="item-info"><strong>仲間 #${i+1}</strong></div><div class="item-actions"><button class="btn-edit" onclick="editMonster(${m.id})">🔧</button><button class="btn-delete" onclick="deleteMonster(${m.id})">🗑️</button></div>`;
        cont.appendChild(item);
    });
}

function editMonster(id) {
    const m = monsters.find(m => m.id === id);
    editingMonsterId = id;
    currentGridSize = m.size;
    gridSizeSelect.value = currentGridSize;
    initCanvas();
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = m.image;
    closeBookModal();
    goToEditor();
    setTimeout(resetView, 100);
}

function createNewMonster() {
    editingMonsterId = null;
    currentGridSize = 32;
    gridSizeSelect.value = 32;
    initCanvas();
    closeBookModal();
    goToEditor();
    setTimeout(resetView, 100);
}

function deleteMonster(id) {
    if(!confirm("削除しますか？")) return;
    monsters = monsters.filter(m => m.id !== id);
    localStorage.setItem('dot_monsters', JSON.stringify(monsters));
    renderMonsterList();
    spawnMonstersInField();
}

function goToField() { document.getElementById('editor-view').style.display = 'none'; document.getElementById('field-view').style.display = 'block'; }
function goToEditor() { document.getElementById('field-view').style.display = 'none'; document.getElementById('editor-view').style.display = 'flex'; }
function openBookModal() { renderMonsterList(); document.getElementById('book-modal').style.display = 'flex'; }
function closeBookModal() { document.getElementById('book-modal').style.display = 'none'; }

function spawnMonstersInField() {
    const area = document.getElementById('monster-field-area');
    area.innerHTML = '';
    monsters.forEach(m => {
        const img = document.createElement('img');
        img.src = m.image;
        img.className = 'monster';
        img.style.left = (20 + Math.random() * 60) + '%';
        img.style.top = (30 + Math.random() * 50) + '%';
        img.style.width = (m.size * 3) + 'px';
        area.appendChild(img);
        animateMonster(img);
    });
}

function animateMonster(el) {
    let baseL = parseFloat(el.style.left);
    let baseT = parseFloat(el.style.top);
    let a = Math.random() * Math.PI * 2;
    function step() {
        if(!document.body.contains(el)) return;
        a += 0.01;
        const x = baseL + Math.cos(a) * 2;
        const y = baseT + Math.sin(a * 0.5) * 2;
        const jump = Math.abs(Math.sin(Date.now() / 200)) * 15;
        el.style.left = x + '%';
        el.style.top = y + '%';
        el.style.transform = `translate(-50%, calc(-50% - ${jump}px))`;
        requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// --- 1. RPGシステム用追加変数 ---
let currentFloor = 1;
let battleActive = false;
let playerParty = [];
let enemyParty = [];

// --- 2. 既存のセーブ処理を拡張 (完成ボタン押下時) ---
// 既存のボタン取得
const saveBtn = document.getElementById('btn-save-monster');

if (saveBtn) {
    saveBtn.onclick = () => {
        const dataUrl = canvas.toDataURL();
        
        if (editingMonsterId !== null) {
            const i = monsters.findIndex(m => m.id === editingMonsterId);
            if (i !== -1) {
                monsters[i].image = dataUrl;
                monsters[i].size = currentGridSize;
            }
        } else {
            if (monsters.length >= MAX_MONSTERS) {
                alert(`最大${MAX_MONSTERS}体までです。`);
                return;
            }
            // 新規作成時はLv1、初期ポイント1を付与
            monsters.push({
                id: Date.now(),
                image: dataUrl,
                size: currentGridSize,
                level: 1,
                points: 1,
                params: { power: 1, speed: 1, hp: 1, intel: 1 },
                trait: null
            });
        }
        
        localStorage.setItem('dot_monsters', JSON.stringify(monsters));
        editingMonsterId = null;
        spawnMonstersInField();
        goToField();
        // 完成直後に設定画面（図鑑）を開く
        openBookModal();
    };
}

// --- 3. 図鑑（強化画面）の表示更新 ---
// 既存の renderMonsterList を「パラメータ・特性設定付き」に書き換え
function renderMonsterList() {
    const listCont = document.getElementById('monster-list');
    if (!listCont) return;
    
    listCont.innerHTML = '';
    document.getElementById('monster-count').textContent = `(${monsters.length}/${MAX_MONSTERS})`;
    document.getElementById('create-new-area').style.display = monsters.length >= MAX_MONSTERS ? 'none' : 'block';

    monsters.forEach((m, i) => {
        // パラメータがない旧データへの補完
        if (!m.params) {
            m.level = 1; m.points = 1; m.trait = null;
            m.params = { power: 1, speed: 1, hp: 1, intel: 1 };
        }

        const item = document.createElement('div');
        item.className = 'book-item';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'flex-start';

        item.innerHTML = `
            <div style="display:flex; width:100%; gap:15px; align-items:center;">
                <img src="${m.image}" style="width:64px; height:64px; border:1px solid #ccc;">
                <div class="item-info">
                    <strong>仲間 No.${i+1} (Lv.${m.level})</strong><br>
                    残りポイント: <b style="color:red; font-size:1.2em;">${m.points}</b>
                </div>
                <div class="item-actions">
                    <button class="btn-edit" onclick="editMonster(${m.id})">描く</button>
                    <button class="btn-delete" onclick="deleteMonster(${m.id})">別れ</button>
                </div>
            </div>
            
            <div style="width:100%; margin-top:10px; background:#f0f0f0; padding:10px; font-size:13px;">
                <div>パワー(攻): ${m.params.power} <button onclick="addParam(${m.id}, 'power')">＋</button></div>
                <div>スピード(速/避): ${m.params.speed} <button onclick="addParam(${m.id}, 'speed')">＋</button></div>
                <div>体力(HP/回復): ${m.params.hp} <button onclick="addParam(${m.id}, 'hp')">＋</button></div>
                <div>知能: ${m.params.intel} <button onclick="addParam(${m.id}, 'intel')">＋</button></div>
                <div style="margin-top:5px; border-top:1px solid #ccc; pt:5px;">
                    特性(5pt): 
                    <select onchange="changeTrait(${m.id}, this.value)">
                        <option value="">なし</option>
                        <option value="毒" ${m.trait==='毒'?'selected':''}>毒</option>
                        <option value="マヒ" ${m.trait==='マヒ'?'selected':''}>マヒ</option>
                        <option value="眠り" ${m.trait==='眠り'?'selected':''}>眠り</option>
                        <option value="混乱" ${m.trait==='混乱'?'selected':''}>混乱</option>
                    </select>
                </div>
            </div>
        `;
        listCont.appendChild(item);
    });
}

// パラメータアップ
function addParam(id, key) {
    const m = monsters.find(m => m.id === id);
    if (m && m.points > 0) {
        m.params[key]++;
        m.points--;
        saveAndRefresh();
    }
}

// 特性変更
function changeTrait(id, val) {
    const m = monsters.find(m => m.id === id);
    if (!m) return;
    if (val === "") { m.trait = null; saveAndRefresh(); return; }
    if (m.trait === val) return;
    if (m.points >= 5) {
        m.trait = val;
        m.points -= 5;
        saveAndRefresh();
    } else {
        alert("ポイントが5足りません");
        renderMonsterList();
    }
}

function saveAndRefresh() {
    localStorage.setItem('dot_monsters', JSON.stringify(monsters));
    renderMonsterList();
}

// --- 4. バトル・ダンジョン UI 追加 ---
// HTMLにバトル用の画面がない場合、動的に追加
if (!document.getElementById('battle-screen')) {
    const bScr = document.createElement('div');
    bScr.id = 'battle-screen';
    bScr.style = "display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:#222; z-index:2000; color:white; font-family:monospace;";
    bScr.innerHTML = `
        <div id="floor-indicator" style="text-align:center; padding:10px; background:#444;">1階</div>
        <div id="battle-area" style="height:50%; position:relative; overflow:hidden; background:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzhhGPABPzAZWIIOIIj8Ad8LBAX4SYXUAAAAAElFTkSuQmCC');"></div>
        <div id="battle-log" style="height:30%; overflow-y:scroll; background:#000; padding:10px; font-size:12px; border-top:2px solid #666;"></div>
        <div style="height:10%; display:flex; justify-content:center; align-items:center; gap:20px;">
            <button id="btn-next-floor" style="display:none; background:green; color:white; padding:10px;" onclick="nextFloor()">次の階へ</button>
            <button style="background:#666; color:white; padding:10px;" onclick="exitDungeon()">撤退</button>
        </div>
    `;
    document.body.appendChild(bScr);
    
    // 草原画面にダンジョンボタンを追加
    const field = document.getElementById('field-view');
    const dBtn = document.createElement('button');
    dBtn.innerHTML = "⚔️ ダンジョンへ";
    dBtn.style = "position:absolute; bottom:20px; left:20px; z-index:100; background:maroon; color:white; padding:15px; border-radius:10px;";
    dBtn.onclick = startDungeon;
    field.appendChild(dBtn);
}

// --- 5. バトルロジック ---
function startDungeon() {
    if (monsters.length === 0) return alert("仲間がいません");
    currentFloor = 1;
    document.getElementById('battle-screen').style.display = 'block';
    setupBattle();
}

function setupBattle() {
    const isBoss = (currentFloor % 10 === 0);
    const enemyLv = isBoss ? Math.floor(currentFloor * 1.5) : currentFloor;
    const enemyCount = isBoss ? 1 : 3;

    document.getElementById('floor-indicator').textContent = `${currentFloor}階 ${isBoss ? '[BOSS]' : ''}`;
    document.getElementById('battle-log').innerHTML = '';
    document.getElementById('btn-next-floor').style.display = 'none';

    playerParty = monsters.map(m => ({ ...m, curHp: m.params.hp * 10, maxHp: m.params.hp * 10, side: 'p', state: null }));
    enemyParty = [];
    for (let i = 0; i < enemyCount; i++) {
        const elv = enemyLv;
        const ep = { power: elv, speed: elv, hp: elv, intel: elv };
        enemyParty.push({
            id: Math.random(), image: '', params: ep, level: elv,
            curHp: ep.hp * 10, maxHp: ep.hp * 10, side: 'e', state: null,
            trait: isBoss ? null : ['毒', 'マヒ', '眠り', '混乱'][Math.floor(Math.random() * 4)],
            isBoss: isBoss
        });
    }
    battleActive = true;
    renderBattleUnits();
    runTurn();
}

async function runTurn() {
    while (battleActive) {
        let actors = [...playerParty, ...enemyParty].filter(u => u.curHp > 0);
        actors.sort((a, b) => b.params.speed - a.params.speed);

        for (let u of actors) {
            if (u.curHp <= 0 || !battleActive) continue;
            await new Promise(r => setTimeout(r, 600));

            // 状態異常判定
            if (u.state === '眠り') {
                if (Math.random() < 0.7) { u.state = null; addLog(`${u.side=='p'?'味方':'敵'}は目が覚めた`); }
                else { addLog(`${u.side=='p'?'味方':'敵'}は眠っている...`); continue; }
            }
            if (u.state === 'マヒ' && Math.random() < 0.2) { addLog(`${u.side=='p'?'味方':'敵'}は痺れて動けない！`); continue; }

            let targets = (u.side === 'p' ? enemyParty : playerParty).filter(t => t.curHp > 0);
            if (u.state === '混乱') targets = [...playerParty, ...enemyParty].filter(t => t.curHp > 0);
            if (targets.length === 0) break;

            let target = targets[Math.floor(Math.random() * targets.length)];
            
            // 攻撃
            if (Math.random() * 100 < target.params.speed) {
                addLog(`${u.side=='p'?'味方':'敵'}の攻撃！ ...回避された`);
            } else {
                let dmg = u.params.power;
                target.curHp -= dmg;
                addLog(`${u.side=='p'?'味方':'敵'}の攻撃！ ${target.side=='p'?'味方':'敵'}に${dmg}ダメ`);
                
                // 特性発動
                if (u.trait && !target.isBoss) {
                    if (u.trait === '毒') { target.curHp -= 2; addLog("毒ダメージ！"); }
                    if (u.trait === 'マヒ') { target.state = 'マヒ'; addLog("マヒさせた！"); }
                    if (u.trait === '眠り' && Math.random() < 0.2) { target.state = '眠り'; addLog("眠らせた！"); }
                    if (u.trait === '混乱') { target.state = '混乱'; addLog("混乱させた！"); }
                }
                if (target.state === '眠り' && Math.random() < 0.7) { target.state = null; addLog("衝撃で目が覚めた！"); }
            }
            renderBattleUnits();
            if (checkEnd()) return;
        }
    }
}

function checkEnd() {
    if (enemyParty.every(e => e.curHp <= 0)) {
        battleActive = false;
        addLog("勝利！全員LvUP & 1pt獲得！");
        monsters.forEach(m => { m.level++; m.points++; });
        saveAndRefresh();
        if (currentFloor < 15) document.getElementById('btn-next-floor').style.display = 'block';
        return true;
    }
    if (playerParty.every(p => p.curHp <= 0)) {
        battleActive = false;
        addLog("全滅しました...");
        return true;
    }
    return false;
}

function nextFloor() { currentFloor++; setupBattle(); }
function exitDungeon() { battleActive = false; document.getElementById('battle-screen').style.display = 'none'; }
function addLog(m) { const l = document.getElementById('battle-log'); l.innerHTML += `<div>${m}</div>`; l.scrollTop = l.scrollHeight; }

function renderBattleUnits() {
    const area = document.getElementById('battle-area');
    area.innerHTML = '';
    [...playerParty, ...enemyParty].forEach((u, i) => {
        if (u.curHp <= 0) return;
        const div = document.createElement('div');
        div.style = `position:absolute; transition:0.3s; left:${u.side=='p'?'20%':'70%'}; top:${20 + (i%3)*25}%; text-align:center;`;
        div.innerHTML = `
            <div style="width:40px; height:4px; background:red; margin:auto;"><div style="width:${(u.curHp/u.maxHp)*100}%; height:100%; background:lime;"></div></div>
            <img src="${u.image}" style="width:50px; image-rendering:pixelated; ${u.side=='e'?'filter:hue-rotate(90deg)':''}">
            <div style="font-size:10px;">${u.state || ''}</div>
        `;
        area.appendChild(div);
    });
}

/* --- 【完全版】BGM切り替え・GitHub対応コード --- */

// 1. オーディオの準備（パスを確実に通す）
const sndField = new Audio('so_sweet.mp3');
const sndBattle = new Audio('Quick_pipes.mp3');
const sndBoss = new Audio('Battle_in_the_Moonlight.mp3');

// 初期設定（ループ・音量8%）
[sndField, sndBattle, sndBoss].forEach(s => {
    s.loop = true;
    s.volume = 0.08;
});

// 2. 再生管理関数
function changeMusic() {
    // 全て停止
    [sndField, sndBattle, sndBoss].forEach(s => {
        s.pause();
        // エラー防止のため再生位置リセットは慎重に
        try { s.currentTime = 0; } catch(e) {}
    });

    const fieldVisible = document.getElementById('field-view').style.display !== 'none';
    const battleVisible = document.getElementById('battle-screen')?.style.display !== 'none';

    if (fieldVisible) {
        sndField.play().catch(() => console.log("再生待ち..."));
    } else if (battleVisible) {
        // 10階ごとのボス判定
        const isBossFloor = (typeof currentFloor !== 'undefined' && currentFloor % 10 === 0);
        if (isBossFloor) {
            sndBoss.play().catch(() => {});
        } else {
            sndBattle.play().catch(() => {});
        }
    }
}

// 3. 全てのボタン操作に「曲変更」を割り込ませる（最強の力技）
document.addEventListener('click', (e) => {
    // 画面が切り替わるのを少し待ってから判定
    setTimeout(changeMusic, 150);
});

// 4. バトル開始や階層移動の関数を直接フックする
const originalSetup = window.setupBattle;
window.setupBattle = function() {
    if(originalSetup) originalSetup();
    setTimeout(changeMusic, 100);
};

const originalNext = window.nextFloor;
window.nextFloor = function() {
    if(originalNext) originalNext();
    setTimeout(changeMusic, 100);
};

const originalExit = window.exitDungeon;
window.exitDungeon = function() {
    if(originalExit) originalExit();
    setTimeout(changeMusic, 100);
};

// 起動時に1回実行
setTimeout(changeMusic, 1000);
