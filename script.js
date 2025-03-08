// Property interfaces
const PROPERTIES = {
    CONTAINER: 'container',    // 可以存储方块
    LOADABLE: 'loadable',     // 可以被装载
    SURFACE: 'surface',       // 可以作为支撑面
    BLOCKING: 'blocking'      // 会阻挡移动
};

// Property check functions
function hasProperty(object, property) {
    if (!object) return false;

    switch (property) {
        case PROPERTIES.CONTAINER:
            return object.type === MACHINE_TYPES.VEHICLE || 
                   object.type === MACHINE_TYPES.CRANE;  // 起重机总是容器

        case PROPERTIES.LOADABLE:
            // 世界方块（非空气）总是可装载的
            if (typeof object === 'string') {
                return object !== BLOCK_TYPES.AIR;
            }
            // 对于机械，只有装载状态才可装载
            if (object.type === MACHINE_TYPES.CRANE) {
                return object.baseLoaded;  // 只有基座装载的方块可以被装载
            }
            return object.loaded;  // 对于车辆，检查是否装载

        case PROPERTIES.SURFACE:
            // 地形方块或装载状态的起重机基座可以作为支撑面
            if (typeof object === 'string') {
                return object === BLOCK_TYPES.DIRT || 
                       object === BLOCK_TYPES.STONE;
            }
            return object.type === MACHINE_TYPES.CRANE && 
                   object.baseLoaded;  // 只有装载状态的基座可以作为支撑面

        case PROPERTIES.BLOCKING:
            // 世界方块（非空气）会阻挡移动
            if (typeof object === 'string') {
                return object !== BLOCK_TYPES.AIR;
            }
            // 对于车辆，装载时阻挡
            if (object.type === MACHINE_TYPES.VEHICLE) {
                return object.loaded;
            }
            // 对于起重机，基座和吊钩分别在各自位置阻挡
            if (object.type === MACHINE_TYPES.CRANE) {
                return false;  // 阻挡检查已移至 isPathBlocked 函数中
            }
            return false;

        default:
            return false;
    }
}

// Content check functions
function getContent(object) {
    if (!object) return null;
    
    if (typeof object === 'string') {
        return object === BLOCK_TYPES.AIR ? null : object;
    }
    
    if (object.type === MACHINE_TYPES.VEHICLE) {
        return object.loaded ? object.loadedBlockType : null;
    }
    
    if (object.type === MACHINE_TYPES.CRANE) {
        // 优先返回基座的内容，其次是吊钩的内容
        if (object.baseLoaded) return object.baseLoadedBlockType;
        if (object.hookLoaded) return object.hookLoadedBlockType;
        return null;
    }
    
    return null;
}

function canAcceptContent(object) {
    if (!object) return false;
    
    if (object.type === MACHINE_TYPES.VEHICLE) {
        return !object.loaded;
    }
    
    if (object.type === MACHINE_TYPES.CRANE) {
        return !object.baseLoaded && !object.hookLoaded;
    }
    
    return false;
}

// Position check functions
function getObjectsAtPosition(x, y) {
    // 返回位置上的所有对象列表
    const objects = [];
    
    // 检查世界边界
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) {
        return objects;
    }

    // 世界方块 (除了空气)
    const blockType = gameState.world[y][x];
    if (blockType !== BLOCK_TYPES.AIR) {
        objects.push(blockType);
    }

    // 检查机械
    for (let i = 0; i < gameState.machines.length; i++) {
        const machine = gameState.machines[i];
        
        if (machine.type === MACHINE_TYPES.VEHICLE) {
            if (machine.x === x && machine.y === y) {
                objects.push(machine);
            }
        } else if (machine.type === MACHINE_TYPES.CRANE) {
            // 检查吊钩位置
            if (machine.x === x && machine.hookY === y) {
                objects.push({
                    type: 'craneHook',
                    craneIndex: i,
                    x: machine.x,
                    y: machine.hookY,
                    loaded: machine.hookLoaded,
                    loadedBlockType: machine.hookLoadedBlockType
                });
            }
            
            // 检查基座位置
            if (machine.x === x && machine.y === y) {
                objects.push({
                    type: 'craneBase',
                    craneIndex: i,
                    x: machine.x,
                    y: machine.y,
                    loaded: machine.baseLoaded,
                    loadedBlockType: machine.baseLoadedBlockType
                });
            }
        }
    }

    return objects;
}

// 兼容旧的获取单个对象的函数，主要用于路径检查等
function getObjectAtPosition(x, y) {
    const objects = getObjectsAtPosition(x, y);
    
    // 如果没有找到对象，返回空气方块
    if (objects.length === 0) {
        return BLOCK_TYPES.AIR;
    }
    
    // 保持与旧函数相同的优先级：吊钩 > 基座 > 车辆 > 世界方块
    for (const obj of objects) {
        if (obj.type === 'craneHook') return obj;
    }
    
    for (const obj of objects) {
        if (obj.type === 'craneBase') return obj;
    }
    
    for (const obj of objects) {
        if (obj.type === MACHINE_TYPES.VEHICLE) return obj;
    }
    
    // 返回世界方块（如果有）
    if (typeof objects[0] === 'string') return objects[0];
    
    // 默认返回空气方块
    return BLOCK_TYPES.AIR;
}

function isPositionLoadable(x, y) {
    const object = getObjectAtPosition(x, y);
    
    // 世界方块（非空气）总是可装载的
    if (typeof object === 'string') {
        return object !== BLOCK_TYPES.AIR;
    }
    
    // 装载状态的基座可装载
    if (object.type === 'craneBase') {
        return object.loaded;
    }
    
    // 装载状态的吊钩可装载
    if (object.type === 'craneHook') {
        return object.loaded;
    }
    
    // 装载状态的车辆可装载
    if (object.type === MACHINE_TYPES.VEHICLE) {
        return object.loaded;
    }
    
    return false;
}

function isPositionUnloadable(x, y) {
    const object = getObjectAtPosition(x, y);
    
    // 空气方块可以卸载到
    if (!object || (typeof object === 'string' && object === BLOCK_TYPES.AIR)) {
        return true;
    }
    
    // 空载的基座可以卸载到
    if (object.type === 'craneBase') {
        return !object.loaded;
    }
    
    // 空载的吊钩可以卸载到
    if (object.type === 'craneHook') {
        return !object.loaded;
    }
    
    // 空载的车辆可以卸载到
    if (object.type === MACHINE_TYPES.VEHICLE) {
        return !object.loaded;
    }
    
    // 其他方块不能卸载到
    return false;
}

function isPositionSurface(x, y) {
    const object = getObjectAtPosition(x, y);
    
    // 泥土和石头可以作为支撑面
    if (typeof object === 'string') {
        return object === BLOCK_TYPES.DIRT || object === BLOCK_TYPES.STONE;
    }
    
    // 装载状态的基座可以作为支撑面
    if (object.type === 'craneBase') {
        return object.loaded;
    }
    
    return false;
}

function isPathBlocked(fromY, toY, x) {
    const startY = Math.min(fromY, toY);
    const endY = Math.max(fromY, toY);
    
    console.log(`========== 检查路径阻挡 ==========`);
    console.log(`检查路径: 从 (${x}, ${fromY}) 到 (${x}, ${toY})`);
    
    // 确定是哪个起重机的吊钩在移动
    let movingCraneIndex = -1;
    for (let i = 0; i < gameState.machines.length; i++) {
        const machine = gameState.machines[i];
        if (machine.type === MACHINE_TYPES.CRANE && 
            machine.x === x && 
            (machine.hookY === fromY)) {
            movingCraneIndex = i;
            console.log(`识别到移动的起重机索引: ${movingCraneIndex}, 吊钩位置: (${machine.x}, ${machine.hookY})`);
            break;
        }
    }
    
    if (movingCraneIndex === -1) {
        console.log(`警告: 未找到匹配的起重机吊钩`);
    }
    
    // 修改路径检查范围，跳过起始位置，只检查要移动的部分
    // 如果是向下移动，从fromY+1开始；如果是向上移动，从fromY-1开始
    const pathStartY = fromY < toY ? fromY + 1 : startY;
    const pathEndY = fromY > toY ? fromY - 1 : endY;
    
    console.log(`实际检查范围: 从 y=${pathStartY} 到 y=${pathEndY}`);
    
    for (let y = pathStartY; y <= pathEndY; y++) {
        console.log(`检查位置 (${x}, ${y})...`);
        
        // 获取位置上的所有对象
        const objectsAtPosition = getObjectsAtPosition(x, y);
        
        if (objectsAtPosition.length === 0) {
            console.log(`  位置 (${x}, ${y}) 无对象`);
            continue;
        }
        
        // 检查每个对象是否会阻挡
        for (const object of objectsAtPosition) {
            console.log(`  位置 (${x}, ${y}) 发现对象: ${typeof object === 'string' ? object : JSON.stringify(object)}`);
            
            // 检查是否是非空气的世界方块
            if (typeof object === 'string') {
                console.log(`  阻挡原因: 非空气的世界方块 (${object})`);
                return true;
            }
            
            // 如果是起重机组件，检查是否是自己的吊钩或基座
            if (object.type === 'craneBase' || object.type === 'craneHook') {
                console.log(`  发现起重机组件: ${object.type}, 索引: ${object.craneIndex}, 当前移动的索引: ${movingCraneIndex}`);
                
                // 如果是自己的组件，只有在装载状态下才阻挡
                if (object.craneIndex === movingCraneIndex) {
                    console.log(`  是自己的起重机组件`);
                    // 这是移动吊钩的起重机的组件
                    if (object.type === 'craneHook') {
                        console.log(`  忽略自己的吊钩位置`);
                        // 忽略自己的吊钩位置（避免自阻挡）
                        continue;
                    } else if (object.type === 'craneBase') {
                        console.log(`  检查自己的基座, 装载状态: ${object.loaded}`);
                        // 基座只有在装载状态下才阻挡
                        if (object.loaded) {
                            console.log(`  阻挡原因: 自己的基座处于装载状态`);
                            return true;
                        }
                    }
                } else {
                    console.log(`  是其他起重机的组件, 装载状态: ${object.loaded}`);
                    // 其他起重机的组件，装载状态下阻挡
                    if (object.loaded) {
                        console.log(`  阻挡原因: 其他起重机组件处于装载状态`);
                        return true;
                    }
                }
            } else if (object.type === MACHINE_TYPES.VEHICLE) {
                console.log(`  发现车辆, 装载状态: ${object.loaded}`);
                if (object.loaded) {
                    console.log(`  阻挡原因: 装载状态的车辆`);
                    return true;
                }
            }
        }
    }
    
    console.log(`路径畅通，无阻挡`);
    return false;
}

// Game constants
const WORLD_WIDTH = 20;
const WORLD_HEIGHT = 10;
const BLOCK_SIZE = 40;

// Block types
const BLOCK_TYPES = {
    AIR: 'air',
    DIRT: 'dirt',
    STONE: 'stone',
    TREE: 'tree',
    WOOD: 'wood'
};

// Machine types
const MACHINE_TYPES = {
    VEHICLE: 'vehicle',
    CRANE: 'crane'
};

// Game state
const gameState = {
    world: [],
    resources: {
        wood: 0
    },
    machines: [],
    selectedMachine: null,
    creatingVehicle: false,
    creatingCrane: false,
    message: '',
    operationCount: 0,
    lastMoveDirection: null
};

// DOM Elements
const gameWorldElement = document.getElementById('game-world');
const woodCountElement = document.getElementById('wood-count');
const createVehicleButton = document.getElementById('btn-create-vehicle');
const createCraneButton = document.getElementById('btn-create-crane');
const vehicleControlsElement = document.getElementById('vehicle-controls');
const craneControlsElement = document.getElementById('crane-controls');
const messageElement = document.getElementById('message-area');
const operationCountElement = document.getElementById('operation-count');
const machinesContainer = document.getElementById('machines-container');

// Add keyboard shortcuts mapping
const KEYBOARD_SHORTCUTS = {
    // Vehicle controls
    'KeyA': () => moveVehicle('left'),
    'KeyD': () => moveVehicle('right'),
    'KeyQ': () => loadVehicle('left'),
    'KeyE': () => loadVehicle('right'),
    'KeyZ': () => unloadVehicle('left'),
    'KeyC': () => unloadVehicle('right'),
    'KeyX': () => {
        const machine = gameState.machines[gameState.selectedMachine];
        if (machine?.type === MACHINE_TYPES.VEHICLE) {
            demolishVehicle();
        } else if (machine?.type === MACHINE_TYPES.CRANE) {
            demolishCrane();
        }
    },
    
    // Crane controls
    'KeyW': () => moveCraneHook('up'),
    'KeyS': () => moveCraneHook('down'),

    // Context-sensitive controls
    'KeyR': () => {
        const machine = gameState.machines[gameState.selectedMachine];
        if (machine?.type === MACHINE_TYPES.VEHICLE) {
            smartLoadVehicle();
        } else if (machine?.type === MACHINE_TYPES.CRANE) {
            attachCraneHook();
        }
    },
    'KeyF': () => {
        const machine = gameState.machines[gameState.selectedMachine];
        if (machine?.type === MACHINE_TYPES.VEHICLE) {
            smartUnloadVehicle(false);  // 与移动方向相同
        } else if (machine?.type === MACHINE_TYPES.CRANE) {
            detachCraneHook();
        }
    },
    'KeyV': () => {
        const machine = gameState.machines[gameState.selectedMachine];
        if (machine?.type === MACHINE_TYPES.VEHICLE) {
            smartUnloadVehicle(true);  // 与移动方向相反
        }
    }
};

// Initialize the game
function initGame() {
    // Initialize game state
    gameState.creatingVehicle = false;
    gameState.creatingCrane = false;
    gameState.message = '';  // 移除初始帮助消息
    gameState.operationCount = 0;
    gameState.machines = [];
    gameState.resources.wood = 2;  // 初始给2个原木
    
    createWorld();
    
    // 创建初始车辆
    const initialVehicle = {
        type: MACHINE_TYPES.VEHICLE,
        x: 1,
        y: WORLD_HEIGHT - 3,
        loaded: false,
        loadedBlockType: null
    };
    gameState.machines.push(initialVehicle);
    
    renderWorld();
    updateMachinesList();
    setupEventListeners();
    
    operationCountElement.textContent = gameState.operationCount;
}

// Create initial world
function createWorld() {
    // Initialize with air
    for (let y = 0; y < WORLD_HEIGHT; y++) {
        gameState.world[y] = [];
        for (let x = 0; x < WORLD_WIDTH; x++) {
            gameState.world[y][x] = BLOCK_TYPES.AIR;
        }
    }

    // Add stone blocks at the bottom
    for (let x = 0; x < WORLD_WIDTH; x++) {
        gameState.world[WORLD_HEIGHT - 1][x] = BLOCK_TYPES.STONE;
    }

    // Add dirt blocks above stone
    for (let x = 0; x < WORLD_WIDTH; x++) {
        gameState.world[WORLD_HEIGHT - 2][x] = BLOCK_TYPES.DIRT;
    }

    // Add initial trees only above dirt, avoiding vehicle position
    addInitialTrees();
}

// Add initial trees
function addInitialTrees() {
    const possiblePositions = [];
    const initialVehicleX = 1; // 初始车辆位置
    
    // 找到所有可以种树的位置（只在泥土上方，且不在初始车辆位置）
    for (let x = 0; x < WORLD_WIDTH; x++) {
        if (x !== initialVehicleX && // 避开初始车辆位置
            gameState.world[WORLD_HEIGHT - 2][x] === BLOCK_TYPES.DIRT &&
            gameState.world[WORLD_HEIGHT - 3][x] === BLOCK_TYPES.AIR) {
            possiblePositions.push(x);
        }
    }
    
    // 随机选择4个位置种树
    for (let i = 0; i < 4; i++) {
        if (possiblePositions.length > 0) {
            const randomIndex = Math.floor(Math.random() * possiblePositions.length);
            const x = possiblePositions.splice(randomIndex, 1)[0];
            gameState.world[WORLD_HEIGHT - 3][x] = BLOCK_TYPES.TREE; // 在泥土上方种树
        }
    }
}

// Update machines list
function updateMachinesList() {
    machinesContainer.innerHTML = '';
    
    gameState.machines.forEach((machine, index) => {
        const machineItem = document.createElement('div');
        machineItem.className = `machine-item${gameState.selectedMachine === index ? ' selected' : ''}`;
        
        const machineIcon = document.createElement('div');
        machineIcon.className = `machine-icon ${machine.type}`;
        
        const machineInfo = document.createElement('div');
        machineInfo.className = 'machine-info';
        
        const machineTitle = document.createElement('div');
        machineTitle.className = 'machine-title';
        machineTitle.textContent = `${machine.type === MACHINE_TYPES.VEHICLE ? '车辆' : '起重机'} #${index + 1} (${machine.x}, ${machine.y})`;
        
        const machineStatus = document.createElement('div');
        machineStatus.className = 'machine-status';
        
        if (machine.type === MACHINE_TYPES.VEHICLE) {
            if (machine.loaded) {
                machineStatus.textContent = `装载: ${getBlockName(machine.loadedBlockType)}`;
                machineStatus.className += ' status-loaded';
            } else {
                machineStatus.textContent = '空载';
                machineStatus.className += ' status-empty';
            }
        } else if (machine.type === MACHINE_TYPES.CRANE) {
            const statusLines = [];
            
            // 显示吊钩状态
            if (machine.hookLoaded) {
                statusLines.push(`吊钩(${machine.x}, ${machine.hookY}): ${getBlockName(machine.hookLoadedBlockType)}`);
                machineStatus.className += ' status-loaded';
            } else {
                statusLines.push(`吊钩(${machine.x}, ${machine.hookY}): 空载`);
                machineStatus.className += ' status-empty';
            }
            
            // 显示基座状态
            if (machine.baseLoaded) {
                statusLines.push(`基座: ${getBlockName(machine.baseLoadedBlockType)}`);
            } else {
                statusLines.push('基座: 空载');
            }
            
            machineStatus.innerHTML = statusLines.join('<br>');
        }
        
        machineInfo.appendChild(machineTitle);
        machineInfo.appendChild(machineStatus);
        
        machineItem.appendChild(machineIcon);
        machineItem.appendChild(machineInfo);
        
        machineItem.addEventListener('click', () => selectMachine(index));
        
        machinesContainer.appendChild(machineItem);
    });
}

// Render the game world
function renderWorld() {
    // Set game world width to accommodate all blocks
    gameWorldElement.style.width = `${WORLD_WIDTH * BLOCK_SIZE}px`;
    gameWorldElement.style.height = `${WORLD_HEIGHT * BLOCK_SIZE}px`;
    gameWorldElement.style.position = 'relative';
    gameWorldElement.style.overflow = 'hidden';

    // Clear the game world
    gameWorldElement.innerHTML = '';

    // 首先渲染世界方块
    for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let x = 0; x < WORLD_WIDTH; x++) {
            const blockType = gameState.world[y][x];
            if (blockType !== BLOCK_TYPES.AIR) {
                const blockElement = document.createElement('div');
                blockElement.className = `block ${blockType}`;
                blockElement.style.left = `${x * BLOCK_SIZE}px`;
                blockElement.style.top = `${y * BLOCK_SIZE}px`;
                blockElement.dataset.x = x;
                blockElement.dataset.y = y;
                
                // 为树添加树干
                if (blockType === BLOCK_TYPES.TREE) {
                    const treeTrunk = document.createElement('div');
                    treeTrunk.className = 'tree-trunk';
                    treeTrunk.style.position = 'absolute';
                    treeTrunk.style.left = '15px';  // 居中
                    treeTrunk.style.top = '25px';   // 树干在树冠下方
                    treeTrunk.style.width = '10px';
                    treeTrunk.style.height = '15px';
                    treeTrunk.style.backgroundColor = '#8B4513'; // 褐色
                    blockElement.appendChild(treeTrunk);
                    
                    // 调整树冠样式
                    blockElement.style.borderRadius = '50% 50% 10% 10%';
                }
                
                gameWorldElement.appendChild(blockElement);
            }
        }
    }

    // 检查机械重叠
    const { baseOverlaps, hookOverlaps } = findMachineOverlaps();

    // 渲染机械
    gameState.machines.forEach((machine, index) => {
        if (machine.type === MACHINE_TYPES.VEHICLE) {
            const vehicleElement = document.createElement('div');
            vehicleElement.className = `block vehicle${machine.loaded ? ' loaded' : ''}`;
            vehicleElement.style.position = 'absolute';  // 确保使用绝对定位
            vehicleElement.style.left = `${machine.x * BLOCK_SIZE}px`;
            vehicleElement.style.top = `${machine.y * BLOCK_SIZE}px`;
            vehicleElement.dataset.machineIndex = index;
            
            // 添加车轮
            const leftWheel = document.createElement('div');
            leftWheel.className = 'wheel';
            leftWheel.style.position = 'absolute';
            leftWheel.style.left = '5px';
            leftWheel.style.bottom = '-5px';
            leftWheel.style.width = '10px';
            leftWheel.style.height = '10px';
            leftWheel.style.borderRadius = '50%';
            leftWheel.style.backgroundColor = '#333';
            vehicleElement.appendChild(leftWheel);
            
            const rightWheel = document.createElement('div');
            rightWheel.className = 'wheel';
            rightWheel.style.position = 'absolute';
            rightWheel.style.right = '5px';
            rightWheel.style.bottom = '-5px';
            rightWheel.style.width = '10px';
            rightWheel.style.height = '10px';
            rightWheel.style.borderRadius = '50%';
            rightWheel.style.backgroundColor = '#333';
            vehicleElement.appendChild(rightWheel);
            
            if (gameState.selectedMachine === index) {
                vehicleElement.classList.add('selected');
            }
            
            if (baseOverlaps[index]) {
                const overlapIndicator = document.createElement('div');
                overlapIndicator.className = 'overlap-indicator';
                overlapIndicator.textContent = '重叠中';
                vehicleElement.appendChild(overlapIndicator);
            }
            
            if (machine.loaded && machine.loadedBlockType) {
                const loadedBlockElement = document.createElement('div');
                loadedBlockElement.className = `loaded-block ${machine.loadedBlockType}`;
                vehicleElement.appendChild(loadedBlockElement);
            }
            
            gameWorldElement.appendChild(vehicleElement);
        } else if (machine.type === MACHINE_TYPES.CRANE) {
            // Render crane base
            const craneBaseElement = document.createElement('div');
            craneBaseElement.className = `block crane-base${machine.baseLoaded ? ' loaded' : ''}`;
            craneBaseElement.style.position = 'absolute';  // 确保使用绝对定位
            craneBaseElement.style.left = `${machine.x * BLOCK_SIZE}px`;
            craneBaseElement.style.top = `${machine.y * BLOCK_SIZE}px`;
            craneBaseElement.dataset.machineIndex = index;
            
            if (gameState.selectedMachine === index) {
                craneBaseElement.classList.add('selected');
            }

            if (baseOverlaps[index]) {
                const overlapIndicator = document.createElement('div');
                overlapIndicator.className = 'overlap-indicator';
                overlapIndicator.textContent = '重叠中';
                craneBaseElement.appendChild(overlapIndicator);
            }
            
            if (machine.baseLoaded && machine.baseLoadedBlockType) {
                const loadedBlockElement = document.createElement('div');
                loadedBlockElement.className = `loaded-block ${machine.baseLoadedBlockType}`;
                craneBaseElement.appendChild(loadedBlockElement);
            }
            
            gameWorldElement.appendChild(craneBaseElement);
            
            // Render crane hook with rope
            const ropeElement = document.createElement('div');
            ropeElement.className = 'crane-rope';
            ropeElement.style.position = 'absolute';  // 确保使用绝对定位
            ropeElement.style.left = `${(machine.x * BLOCK_SIZE) + 19}px`;
            ropeElement.style.top = `${machine.y * BLOCK_SIZE}px`;
            ropeElement.style.height = `${(machine.hookY - machine.y) * BLOCK_SIZE}px`;
            gameWorldElement.appendChild(ropeElement);
            
            // Render crane hook
            const craneHookElement = document.createElement('div');
            craneHookElement.className = `crane-hook${machine.hookLoaded ? ' loaded' : ''}`;
            craneHookElement.style.position = 'absolute';  // 确保使用绝对定位
            craneHookElement.style.left = `${machine.x * BLOCK_SIZE + 10}px`;
            craneHookElement.style.top = `${machine.hookY * BLOCK_SIZE}px`;
            
            // 添加吊钩重叠指示器
            if (hookOverlaps[index]) {
                const hookOverlapIndicator = document.createElement('div');
                hookOverlapIndicator.className = 'overlap-indicator';
                hookOverlapIndicator.textContent = '重叠中';
                hookOverlapIndicator.style.right = '-40px'; // 调整位置，确保不挡住吊钩
                craneHookElement.appendChild(hookOverlapIndicator);
            }
            
            if (machine.hookLoaded && machine.hookLoadedBlockType) {
                const loadedBlockElement = document.createElement('div');
                loadedBlockElement.className = `loaded-block ${machine.hookLoadedBlockType}`;
                craneHookElement.appendChild(loadedBlockElement);
            }
            
            gameWorldElement.appendChild(craneHookElement);
        }
    });

    // Update resources display
    woodCountElement.textContent = gameState.resources.wood;
    
    // Update button states
    createVehicleButton.disabled = gameState.resources.wood < 1;
    createCraneButton.disabled = gameState.resources.wood < 2;
    
    if (messageElement) {
        messageElement.textContent = gameState.message;
    }
}

// 检查机械重叠
function findMachineOverlaps() {
    const overlaps = {};
    const hookOverlaps = {};
    
    // 检查每对机械之间的重叠
    for (let i = 0; i < gameState.machines.length; i++) {
        const machine1 = gameState.machines[i];
        
        // 检查基座重叠
        for (let j = i + 1; j < gameState.machines.length; j++) {
            const machine2 = gameState.machines[j];
            
            // 检查是否在同一位置
            if (machine1.x === machine2.x && machine1.y === machine2.y) {
                overlaps[i] = true;
                overlaps[j] = true;
            }
        }
        
        // 检查吊钩重叠 - 只针对起重机类型的机械
        if (machine1.type === MACHINE_TYPES.CRANE) {
            // 检查吊钩是否与其他吊钩重叠
            for (let j = i + 1; j < gameState.machines.length; j++) {
                const machine2 = gameState.machines[j];
                if (machine2.type === MACHINE_TYPES.CRANE && 
                    machine1.x === machine2.x && 
                    machine1.hookY === machine2.hookY) {
                    hookOverlaps[i] = true;
                    hookOverlaps[j] = true;
                }
            }
            
            // 检查吊钩是否与车辆重叠
            for (let j = 0; j < gameState.machines.length; j++) {
                if (i !== j) {  // 避免与自己比较
                    const machine2 = gameState.machines[j];
                    if (machine2.type === MACHINE_TYPES.VEHICLE && 
                        machine1.x === machine2.x && 
                        machine1.hookY === machine2.y) {
                        hookOverlaps[i] = true;
                    }
                }
            }
        }
    }
    
    return { baseOverlaps: overlaps, hookOverlaps: hookOverlaps };
}

// Setup event listeners
function setupEventListeners() {
    // Add keyboard event listener
    document.addEventListener('keydown', (event) => {
        // Only handle shortcuts if not in text input
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        const action = KEYBOARD_SHORTCUTS[event.code];
        if (action && gameState.selectedMachine !== null) {
            action();
            event.preventDefault();
        }
    });

    // Create vehicle button
    createVehicleButton.addEventListener('click', createVehicle);
    
    // Create crane button
    createCraneButton.addEventListener('click', createCrane);
    
    // Vehicle control buttons
    document.getElementById('btn-vehicle-move-left').addEventListener('click', () => moveVehicle('left'));
    document.getElementById('btn-vehicle-move-right').addEventListener('click', () => moveVehicle('right'));
    document.getElementById('btn-vehicle-load-left').addEventListener('click', () => loadVehicle('left'));
    document.getElementById('btn-vehicle-load-right').addEventListener('click', () => loadVehicle('right'));
    document.getElementById('btn-vehicle-unload-left').addEventListener('click', () => unloadVehicle('left'));
    document.getElementById('btn-vehicle-unload-right').addEventListener('click', () => unloadVehicle('right'));
    document.getElementById('btn-vehicle-demolish').addEventListener('click', demolishVehicle);
    
    // Crane control buttons
    document.getElementById('btn-crane-move-up').addEventListener('click', () => moveCraneHook('up'));
    document.getElementById('btn-crane-move-down').addEventListener('click', () => moveCraneHook('down'));
    document.getElementById('btn-crane-attach').addEventListener('click', attachCraneHook);
    document.getElementById('btn-crane-detach').addEventListener('click', detachCraneHook);
    document.getElementById('btn-crane-demolish').addEventListener('click', demolishCrane);
    
    // Game world click to select machine
    gameWorldElement.addEventListener('click', (event) => {
        // If not in creation mode, handle machine selection
        if (!gameState.creatingVehicle && !gameState.creatingCrane) {
            let target = event.target;
            
            // 向上查找带有machineIndex的父元素
            while (target && target !== gameWorldElement) {
                if (target.dataset.machineIndex !== undefined) {
                    selectMachine(parseInt(target.dataset.machineIndex));
                    return;
                }
                target = target.parentElement;
            }
        }
    });
}

// Create a vehicle
function createVehicle() {
    if (gameState.resources.wood < 1) {
        gameState.message = '原木不足！';
        renderWorld();
        return;
    }
    
    // Set creation mode
    gameState.creatingVehicle = true;
    gameState.message = '请点击地面位置来放置车辆';
    renderWorld();
    
    // Add temporary click event to game world
    gameWorldElement.addEventListener('click', placeVehicle);
}

// Place vehicle at clicked position
function placeVehicle(event) {
    if (!gameState.creatingVehicle) {
        gameWorldElement.removeEventListener('click', placeVehicle);
        return;
    }
    
    // Get clicked position
    const rect = gameWorldElement.getBoundingClientRect();
    const clickX = Math.floor((event.clientX - rect.left) / BLOCK_SIZE);
    let clickY = Math.floor((event.clientY - rect.top) / BLOCK_SIZE);
    
    // Check if it's a valid position
    if (clickX >= 0 && clickX < WORLD_WIDTH && clickY >= 0 && clickY < WORLD_HEIGHT) {
        // 从点击位置向下寻找最近的地面
        let groundY = clickY;
        while (groundY < WORLD_HEIGHT - 1 && 
               gameState.world[groundY + 1][clickX] === BLOCK_TYPES.AIR) {
            groundY++;
        }
        
        // 如果找到地面，将机械放在地面上方
        if (groundY < WORLD_HEIGHT - 1 && 
            (gameState.world[groundY + 1][clickX] === BLOCK_TYPES.DIRT || 
             gameState.world[groundY + 1][clickX] === BLOCK_TYPES.STONE)) {
            
            // Create vehicle (放在地面上方)
            const vehicle = {
                type: MACHINE_TYPES.VEHICLE,
                x: clickX,
                y: groundY,  // groundY已经是正确的位置（地面上方一格）
                loaded: false,
                loadedBlockType: null
            };
            
            // 检查是否与其他机械重叠
            let hasOverlap = false;
            for (const machine of gameState.machines) {
                if (machine.x === vehicle.x && machine.y === vehicle.y) {
                    hasOverlap = true;
                    break;
                }
            }
            
            if (hasOverlap) {
                gameState.message = '此位置已有其他机械！';
                renderWorld();
                return;
            }
            
            gameState.machines.push(vehicle);
            gameState.resources.wood--;
            selectMachine(gameState.machines.length - 1);
            
            // End creation mode
            gameState.creatingVehicle = false;
            gameWorldElement.removeEventListener('click', placeVehicle);
            gameState.message = '车辆已创建！点击车辆选择它';
            
            updateMachinesList();
            renderWorld();
        } else {
            gameState.message = '此位置无法放置车辆！请选择地面上方的位置';
            renderWorld();
        }
    }
}

// Create a crane
function createCrane() {
    if (gameState.resources.wood < 2) {
        gameState.message = '原木不足！';
        renderWorld();
        return;
    }
    
    // Set creation mode
    gameState.creatingCrane = true;
    gameState.message = '请点击地面位置来放置起重机';
    renderWorld();
    
    // Add temporary click event to game world
    gameWorldElement.addEventListener('click', placeCrane);
}

// Place crane at clicked position
function placeCrane(event) {
    if (!gameState.creatingCrane) {
        gameWorldElement.removeEventListener('click', placeCrane);
        return;
    }
    
    // Get clicked position
    const rect = gameWorldElement.getBoundingClientRect();
    const clickX = Math.floor((event.clientX - rect.left) / BLOCK_SIZE);
    let clickY = Math.floor((event.clientY - rect.top) / BLOCK_SIZE);
    
    // Check if it's a valid position
    if (clickX >= 0 && clickX < WORLD_WIDTH && clickY >= 0 && clickY < WORLD_HEIGHT) {
        // 从点击位置向下寻找最近的地面
        let groundY = clickY;
        while (groundY < WORLD_HEIGHT - 1 && 
               gameState.world[groundY + 1][clickX] === BLOCK_TYPES.AIR) {
            groundY++;
        }
        
        // 如果找到地面，将机械放在地面上方
        if (groundY < WORLD_HEIGHT - 1 && 
            (gameState.world[groundY + 1][clickX] === BLOCK_TYPES.DIRT || 
             gameState.world[groundY + 1][clickX] === BLOCK_TYPES.STONE)) {
            
            // 创建起重机，吊钩的初始位置与基座相同
            const crane = {
                type: MACHINE_TYPES.CRANE,
                x: clickX,
                y: groundY,  // 基座位置
                hookY: groundY,  // 吊钩初始位置与基座相同
                baseLoaded: false,
                baseLoadedBlockType: null,
                hookLoaded: false,
                hookLoadedBlockType: null
            };
            
            // 检查是否与其他机械重叠
            let hasOverlap = false;
            for (const machine of gameState.machines) {
                if (machine.x === crane.x && machine.y === crane.y) {
                    hasOverlap = true;
                    break;
                }
            }
            
            if (hasOverlap) {
                gameState.message = '此位置已有其他机械！';
                renderWorld();
                return;
            }
            
            gameState.machines.push(crane);
            gameState.resources.wood -= 2;
            selectMachine(gameState.machines.length - 1);
            
            // End creation mode
            gameState.creatingCrane = false;
            gameWorldElement.removeEventListener('click', placeCrane);
            gameState.message = '起重机已创建！点击起重机选择它';
            
            updateMachinesList();
            renderWorld();
        } else {
            gameState.message = '此位置无法放置起重机！请选择地面上方的位置';
            renderWorld();
        }
    }
}

// Select a machine
function selectMachine(index) {
    gameState.selectedMachine = index;
    
    // Show the appropriate controls
    const machine = gameState.machines[index];
    if (machine.type === MACHINE_TYPES.VEHICLE) {
        vehicleControlsElement.style.display = 'block';
        craneControlsElement.style.display = 'none';
    } else if (machine.type === MACHINE_TYPES.CRANE) {
        vehicleControlsElement.style.display = 'none';
        craneControlsElement.style.display = 'block';
    }
    
    updateMachinesList();
    renderWorld();
}

// Move vehicle left or right
function moveVehicle(direction) {
    console.log('========== 执行车辆移动 ==========');
    
    if (gameState.selectedMachine === null || 
        gameState.machines[gameState.selectedMachine].type !== MACHINE_TYPES.VEHICLE) {
        return;
    }
    
    const vehicle = gameState.machines[gameState.selectedMachine];
    const newX = direction === 'left' ? vehicle.x - 1 : vehicle.x + 1;
    
    console.log(`车辆尝试从(${vehicle.x}, ${vehicle.y})移动到(${newX}, ${vehicle.y})`);
    
    // 检查世界边界
    if (newX < 0 || newX >= WORLD_WIDTH) {
        console.log('错误: 已到达世界边界');
        gameState.message = '无法移动！已到达边界';
        renderWorld();
        updateMachinesList();
        return;
    }
    
    // 获取相关位置的所有对象
    const currentPos = getObjectsAtPosition(vehicle.x, vehicle.y);
    const targetPos = getObjectsAtPosition(newX, vehicle.y);
    const belowTarget = getObjectsAtPosition(newX, vehicle.y + 1);
    const aboveTarget = getObjectsAtPosition(newX, vehicle.y - 1);
    const targetDiagonal = getObjectsAtPosition(newX, vehicle.y + 1);
    
    console.log(`当前位置: ${JSON.stringify(currentPos)}`);
    console.log(`目标位置: ${JSON.stringify(targetPos)}`);
    console.log(`目标位置下方: ${JSON.stringify(belowTarget)}`);
    console.log(`目标位置上方: ${JSON.stringify(aboveTarget)}`);
    
    // 检查目标位置是否为空或只包含可穿过的对象(空载吊钩/基座)
    // 修改为使用every()检查所有对象，而不是要求只有一个对象
    const isTargetClear = targetPos.length === 0 || 
        targetPos.every(obj => 
            obj === BLOCK_TYPES.AIR || 
            (obj.type === 'craneHook' && !obj.loaded) ||
            (obj.type === 'craneBase' && !obj.loaded)
        );
    
    console.log(`目标位置是否畅通: ${isTargetClear}`);
    
    // 检查下方是否有支撑面（地形或装载状态的基座）
    const hasSupportBelow = belowTarget.some(obj => 
        (typeof obj === 'string' && (obj === BLOCK_TYPES.DIRT || obj === BLOCK_TYPES.STONE)) ||
        (obj.type === 'craneBase' && obj.loaded)
    );
    
    console.log(`目标位置下方是否有支撑面: ${hasSupportBelow}`);
    
    // 确定可能的移动方式
    let moved = false;
    
    // 1. 同一高度移动 - 目标位置畅通且下方有支撑
    if (isTargetClear && hasSupportBelow) {
        console.log('执行同一高度移动');
        vehicle.x = newX;
        moved = true;
    } 
    // 2. 向上移动（爬升一格）- 目标位置有坚实地面或装载的基座，且上方空间畅通
    else {
        // 检查目标位置是否是可以作为支撑面的方块（泥土、石头或装载的基座）
        const isTargetSurface = targetPos.some(obj => 
            (typeof obj === 'string' && (obj === BLOCK_TYPES.DIRT || obj === BLOCK_TYPES.STONE)) ||
            (obj.type === 'craneBase' && obj.loaded)
        );
        
        // 检查上方位置是否畅通
        const isAboveClear = aboveTarget.length === 0 || 
            aboveTarget.every(obj => 
                obj === BLOCK_TYPES.AIR ||
                (obj.type === 'craneHook' && !obj.loaded)
            );
        
        console.log(`目标位置是否可作为支撑面: ${isTargetSurface}`);
        console.log(`上方位置是否畅通: ${isAboveClear}`);
        
        if (isTargetSurface && isAboveClear) {
            console.log('执行向上移动');
            vehicle.x = newX;
            vehicle.y = vehicle.y - 1;
            moved = true;
        }
        // 3. 向下移动 - 目标位置下一格有支撑面，且目标位置和当前位置下方都畅通
        else {
            // 向下移动需要检查的位置: (newX, vehicle.y + 1)
            const potentialDownwardPos = getObjectsAtPosition(newX, vehicle.y + 1);
            // 修改为使用every()检查所有对象
            const isClearForDownward = potentialDownwardPos.length === 0 || 
                potentialDownwardPos.every(obj => 
                    obj === BLOCK_TYPES.AIR ||
                    (obj.type === 'craneHook' && !obj.loaded) ||
                    (obj.type === 'craneBase' && !obj.loaded)
                );
            
            // 检查下两格是否有支撑面
            const twoBelow = getObjectsAtPosition(newX, vehicle.y + 2);
            const hasSupportTwoBelow = twoBelow.some(obj => 
                (typeof obj === 'string' && (obj === BLOCK_TYPES.DIRT || obj === BLOCK_TYPES.STONE)) ||
                (obj.type === 'craneBase' && obj.loaded)
            );
            
            console.log(`向下移动位置是否畅通: ${isClearForDownward}`);
            console.log(`下两格是否有支撑面: ${hasSupportTwoBelow}`);
            
            if (isClearForDownward && hasSupportTwoBelow) {
                console.log('执行向下移动');
                vehicle.x = newX;
                vehicle.y = vehicle.y + 1;
                moved = true;
            }
        }
    }

    if (moved) {
        gameState.lastMoveDirection = direction;
        console.log(`移动成功: (${vehicle.x}, ${vehicle.y})`);
        incrementOperationCount();
        renderWorld();
        updateMachinesList();
    } else {
        gameState.message = '无法移动！地形不适合';
        console.log('移动失败: 未找到合适的路径');
        renderWorld();
        updateMachinesList();
    }
}

// Move crane hook up or down
function moveCraneHook(direction) {
    if (gameState.selectedMachine === null || 
        gameState.machines[gameState.selectedMachine].type !== MACHINE_TYPES.CRANE) {
        return;
    }
    
    const crane = gameState.machines[gameState.selectedMachine];
    const newHookY = direction === 'up' ? crane.hookY - 1 : crane.hookY + 1;
    
    // 限制吊钩移动范围
    // 1. 不能超出世界边界
    // 2. 不能上升超过基座位置
    if (newHookY < 0 || newHookY >= WORLD_HEIGHT) {
        gameState.message = '吊钩无法移动到该位置';
        renderWorld();
        updateMachinesList();
        return;
    }
    
    // 限制吊钩不能上升超过基座位置
    if (direction === 'up' && newHookY < crane.y) {
        gameState.message = '吊钩不能上升超过基座位置';
        renderWorld();
        updateMachinesList();
        return;
    }

    // 仅当吊钩装载了物品时，才检查路径是否被阻挡
    if (crane.hookLoaded) {
        // 使用直接路径检查而不是属性系统
        if (isPathBlocked(crane.hookY, newHookY, crane.x)) {
            gameState.message = '移动路径被阻挡';
            renderWorld();
            updateMachinesList();
            return;
        }
    } else {
        // 空载吊钩可以穿过任何东西，不需要检查路径阻挡
        console.log(`空载吊钩移动，可以自由穿过任何物体`);
    }
    
    // Move the hook
    crane.hookY = newHookY;
    incrementOperationCount();
    renderWorld();
    updateMachinesList();
}

// Load vehicle from adjacent position
function loadVehicle(direction) {
    console.log('========== 执行车辆装载功能 ==========');
    
    if (gameState.selectedMachine === null || 
        gameState.machines[gameState.selectedMachine].type !== MACHINE_TYPES.VEHICLE) {
        console.log('未选中车辆或选中的不是车辆');
        return;
    }
    
    const vehicle = gameState.machines[gameState.selectedMachine];
    console.log(`车辆信息: 索引=${gameState.selectedMachine}, 位置=(${vehicle.x}, ${vehicle.y})`);
    console.log(`车辆状态: 已装载=${vehicle.loaded}, 装载物品=${vehicle.loadedBlockType}`);
    
    if (vehicle.loaded) {
        console.log('错误: 车辆已满载');
        gameState.message = '车辆已满载！';
        renderWorld();
        updateMachinesList();
        return;
    }
    
    const adjacentX = direction === 'left' ? vehicle.x - 1 : vehicle.x + 1;
    console.log(`检查相邻位置: (${adjacentX}, ${vehicle.y})`);
    
    // 获取相邻位置所有对象
    const objectsAtPosition = getObjectsAtPosition(adjacentX, vehicle.y);
    console.log(`相邻位置所有对象: ${JSON.stringify(objectsAtPosition)}`);
    
    if (objectsAtPosition.length === 0) {
        console.log('错误: 没有可装载的内容');
        gameState.message = '没有可装载的内容！';
        renderWorld();
        updateMachinesList();
        return;
    }
    
    // 寻找可装载的对象
    let targetObject = null;
    let content = null;
    
    // 优先检查基座
    for (const obj of objectsAtPosition) {
        if (obj.type === 'craneBase' && obj.loaded) {
            targetObject = obj;
            content = obj.loadedBlockType;
            console.log(`找到可装载的基座: ${JSON.stringify(obj)}, 内容: ${content}`);
            break;
        }
    }
    
    // 检查世界方块
    if (!targetObject) {
        for (const obj of objectsAtPosition) {
            if (typeof obj === 'string' && obj !== BLOCK_TYPES.AIR) {
                targetObject = obj;
                content = obj;
                console.log(`找到可装载的世界方块: ${obj}`);
                break;
            }
        }
    }
    
    if (!targetObject || !content) {
        console.log('错误: 没有可装载的内容');
        gameState.message = '没有可装载的内容！';
        renderWorld();
        updateMachinesList();
        return;
    }
    
    // 处理树木特殊情况
    if (content === BLOCK_TYPES.TREE) {
        gameState.resources.wood++;
        gameState.message = '获得了1个原木！';
        
        // 从世界中移除树木
        if (typeof targetObject === 'string') {
            gameState.world[vehicle.y][adjacentX] = BLOCK_TYPES.AIR;
        }
        
        console.log('从树木获得原木');
        incrementOperationCount();
        renderWorld();
        updateMachinesList();
        return;
    }
    
    // 装载其他类型的方块
    console.log(`装载内容: ${content}`);
    vehicle.loaded = true;
    vehicle.loadedBlockType = content;
    
    // 从源对象移除内容
    if (typeof targetObject === 'string') {
        console.log(`从世界(${adjacentX}, ${vehicle.y})移除方块`);
        gameState.world[vehicle.y][adjacentX] = BLOCK_TYPES.AIR;
    } else if (targetObject.type === 'craneBase') {
        console.log(`从基座(${targetObject.x}, ${targetObject.y})移除方块, 基座索引: ${targetObject.craneIndex}`);
        
        // 确保craneIndex存在
        if (targetObject.craneIndex !== undefined) {
            // 直接使用索引更新原始起重机对象
            const crane = gameState.machines[targetObject.craneIndex];
            if (crane && crane.type === MACHINE_TYPES.CRANE) {
                crane.baseLoaded = false;
                crane.baseLoadedBlockType = null;
                console.log(`已更新起重机[${targetObject.craneIndex}]的基座状态: 清空成功`);
            } else {
                console.log(`错误: 无效的起重机索引 ${targetObject.craneIndex}`);
            }
        } else {
            console.log('错误: 无法找到基座对应的起重机索引');
        }
    }
    
    const blockName = getBlockName(content);
    gameState.message = `装载了${blockName}方块`;
    console.log(`操作成功: ${gameState.message}`);
    
    incrementOperationCount();
    renderWorld();
    updateMachinesList();
}

// 获取方块的中文名称
function getBlockName(blockType) {
    switch(blockType) {
        case BLOCK_TYPES.DIRT: return '泥土';
        case BLOCK_TYPES.STONE: return '石头';
        case BLOCK_TYPES.TREE: return '树';
        case BLOCK_TYPES.WOOD: return '原木';
        default: return '未知';
    }
}

// 修改卸载函数，让车辆可以向起重机基座卸载
function unloadVehicle(direction) {
    if (gameState.selectedMachine === null || 
        gameState.machines[gameState.selectedMachine].type !== MACHINE_TYPES.VEHICLE) {
        return;
    }
    
    const vehicle = gameState.machines[gameState.selectedMachine];
    
    if (!vehicle.loaded) {
        gameState.message = '车辆没有装载方块！';
        renderWorld();
        updateMachinesList();
        return;
    }
    
    const adjacentX = direction === 'left' ? vehicle.x - 1 : vehicle.x + 1;
    
    // 首先检查是否可以卸载到空的起重机基座
    const crane = gameState.machines.find(machine => 
        machine.type === MACHINE_TYPES.CRANE &&
        machine.x === adjacentX &&
        machine.y === vehicle.y &&
        !machine.baseLoaded
    );
    
    if (crane) {
        // 卸载到起重机基座
        crane.baseLoaded = true;
        crane.baseLoadedBlockType = vehicle.loadedBlockType;
        vehicle.loaded = false;
        vehicle.loadedBlockType = null;
        const blockName = getBlockName(crane.baseLoadedBlockType);
        gameState.message = `将${blockName}方块卸载到起重机基座`;
        incrementOperationCount();
        renderWorld();
        updateMachinesList();
        return;
    }
    
    // 如果没有合适的起重机基座，再尝试卸载到世界中
    if (adjacentX >= 0 && adjacentX < WORLD_WIDTH && 
        getBlockAtPosition(adjacentX, vehicle.y) === BLOCK_TYPES.AIR) {
        
        // 卸载到世界中
        gameState.world[vehicle.y][adjacentX] = vehicle.loadedBlockType;
        const blockName = getBlockName(vehicle.loadedBlockType);
        vehicle.loaded = false;
        vehicle.loadedBlockType = null;
        gameState.message = `卸载了${blockName}方块`;
        incrementOperationCount();
        renderWorld();
        updateMachinesList();
        return;
    }
    
    gameState.message = '无法卸载！位置不可用';
    renderWorld();
    updateMachinesList();
}

// Demolish the vehicle
function demolishVehicle() {
    if (gameState.selectedMachine === null || 
        gameState.machines[gameState.selectedMachine].type !== MACHINE_TYPES.VEHICLE) {
        return;
    }
    
    const vehicle = gameState.machines[gameState.selectedMachine];
    
    if (vehicle.loaded) {
        gameState.message = '车辆装载有方块，无法拆除！';
        renderWorld();
        return;
    }
    
    // Return the wood resource
    gameState.resources.wood++;
    
    // Remove the vehicle
    gameState.machines.splice(gameState.selectedMachine, 1);
    gameState.selectedMachine = null;
    
    vehicleControlsElement.style.display = 'none';
    craneControlsElement.style.display = 'none';
    
    updateMachinesList();
    renderWorld();
}

// Attach a block to the crane hook
function attachCraneHook() {
    console.log('========== 执行黏附功能 ==========');
    
    if (gameState.selectedMachine === null || 
        gameState.machines[gameState.selectedMachine].type !== MACHINE_TYPES.CRANE) {
        console.log('未选中起重机或选中的不是起重机');
        return;
    }
    
    const crane = gameState.machines[gameState.selectedMachine];
    console.log(`起重机信息: 索引=${gameState.selectedMachine}, 位置=(${crane.x}, ${crane.y}), 吊钩位置=(${crane.x}, ${crane.hookY})`);
    console.log(`起重机状态: 基座已装载=${crane.baseLoaded}, 吊钩已装载=${crane.hookLoaded}`);
    
    if (crane.hookLoaded) {
        console.log('错误: 吊钩已有方块，无法黏附');
        gameState.message = '吊钩已有方块！';
        renderWorld();
        updateMachinesList();
        return;
    }
    
    // 检查上方是否有车辆（物理安全检查）
    const objectsAbove = getObjectsAtPosition(crane.x, crane.hookY - 1);
    console.log(`吊钩上方位置对象: ${JSON.stringify(objectsAbove)}`);
    
    // 检查上方是否有车辆
    const hasVehicleAbove = objectsAbove.some(obj => obj.type === MACHINE_TYPES.VEHICLE);
    if (hasVehicleAbove) {
        console.log('错误: 吊钩上方有车辆，抓取会导致车辆悬空');
        gameState.message = '无法抓取！上方有车辆会失去支撑';
        renderWorld();
        updateMachinesList();
        return;
    }
    
    // 获取当前位置所有对象
    const objectsAtPosition = getObjectsAtPosition(crane.x, crane.hookY);
    console.log(`目标位置所有对象: ${JSON.stringify(objectsAtPosition)}`);
    
    // 移除列表中的吊钩本身（避免自我黏附）
    const availableObjects = objectsAtPosition.filter(obj => 
        !(obj.type === 'craneHook' && obj.craneIndex === gameState.selectedMachine)
    );
    console.log(`可操作的对象: ${JSON.stringify(availableObjects)}`);
    
    // 寻找可黏附的对象
    let targetObject = null;
    let content = null;
    
    // 优先检查基座（如果吊钩和基座在同一位置）
    for (const obj of availableObjects) {
        if (obj.type === 'craneBase' && obj.loaded) {
            targetObject = obj;
            content = obj.loadedBlockType;
            console.log(`找到可黏附的基座: ${JSON.stringify(obj)}`);
            break;
        }
    }
    
    // 检查车辆
    if (!targetObject) {
        for (const obj of availableObjects) {
            if (obj.type === MACHINE_TYPES.VEHICLE && obj.loaded) {
                targetObject = obj;
                content = obj.loadedBlockType;
                console.log(`找到可黏附的车辆: ${JSON.stringify(obj)}`);
                break;
            }
        }
    }
    
    // 检查世界方块
    if (!targetObject) {
        for (const obj of availableObjects) {
            if (typeof obj === 'string' && obj !== BLOCK_TYPES.AIR) {
                targetObject = obj;
                content = obj;
                console.log(`找到可黏附的世界方块: ${obj}`);
                break;
            }
        }
    }
    
    // 检查是否找到了可装载的内容
    if (!targetObject || !content) {
        console.log('错误: 没有可黏附的方块');
        gameState.message = '没有可黏附的方块！';
        renderWorld();
        updateMachinesList();
        return;
    }
    
    console.log(`准备装载内容: ${content}`);
    
    // 装载内容到吊钩
    crane.hookLoaded = true;
    crane.hookLoadedBlockType = content;
    console.log(`吊钩已装载: ${crane.hookLoadedBlockType}`);
    
    // 从源对象移除内容
    if (typeof targetObject === 'string') {
        console.log(`从世界(${crane.x}, ${crane.hookY})移除方块`);
        gameState.world[crane.hookY][crane.x] = BLOCK_TYPES.AIR;
    } else if (targetObject.type === 'craneBase') {
        console.log(`从基座(${targetObject.x}, ${targetObject.y})移除方块`);
        // 查找原始起重机对象并更新
        if (targetObject.craneIndex !== undefined) {
            gameState.machines[targetObject.craneIndex].baseLoaded = false;
            gameState.machines[targetObject.craneIndex].baseLoadedBlockType = null;
            console.log(`已更新起重机[${targetObject.craneIndex}]的基座状态`);
        } else {
            console.log('错误: 无法找到基座对应的起重机索引');
        }
    } else if (targetObject.type === MACHINE_TYPES.VEHICLE) {
        console.log(`从车辆移除方块`);
        // 查找车辆并更新
        for (let i = 0; i < gameState.machines.length; i++) {
            const machine = gameState.machines[i];
            if (machine.type === MACHINE_TYPES.VEHICLE && 
                machine.x === crane.x && machine.y === crane.hookY) {
                machine.loaded = false;
                machine.loadedBlockType = null;
                console.log(`已更新车辆[${i}]的装载状态`);
                break;
            }
        }
    }
    
    const blockName = getBlockName(content);
    gameState.message = `吊钩黏附了${blockName}方块`;
    console.log(`操作成功: ${gameState.message}`);
    
    incrementOperationCount();
    renderWorld();
    updateMachinesList();
}

// Detach a block from the crane hook
function detachCraneHook() {
    console.log('========== 执行脱离功能 ==========');
    
    if (gameState.selectedMachine === null || 
        gameState.machines[gameState.selectedMachine].type !== MACHINE_TYPES.CRANE) {
        console.log('未选中起重机或选中的不是起重机');
        return;
    }
    
    const crane = gameState.machines[gameState.selectedMachine];
    console.log(`起重机信息: 索引=${gameState.selectedMachine}, 位置=(${crane.x}, ${crane.y}), 吊钩位置=(${crane.x}, ${crane.hookY})`);
    console.log(`起重机状态: 基座已装载=${crane.baseLoaded}, 吊钩已装载=${crane.hookLoaded}`);
    
    if (!crane.hookLoaded) {
        console.log('错误: 吊钩没有方块，无法脱离');
        gameState.message = '吊钩没有方块！';
        renderWorld();
        updateMachinesList();
        return;
    }
    
    // 获取当前位置所有对象（除了吊钩自身）
    const objectsAtPosition = getObjectsAtPosition(crane.x, crane.hookY);
    const availableObjects = objectsAtPosition.filter(obj => 
        !(obj.type === 'craneHook' && obj.craneIndex === gameState.selectedMachine)
    );
    
    console.log(`目标位置所有对象: ${JSON.stringify(availableObjects)}`);
    
    // 检查是否有车辆在位置上 - 如果有则不允许脱离
    for (const obj of availableObjects) {
        if (obj.type === MACHINE_TYPES.VEHICLE) {
            console.log('错误: 目标位置有车辆，无法脱离');
            gameState.message = '不能向车辆所在位置脱离方块！';
            renderWorld();
            updateMachinesList();
            return;
        }
    }
    
    // 检查是否有基座在位置上 - 如果有则优先给基座
    let targetBase = null;
    for (const obj of availableObjects) {
        if (obj.type === 'craneBase' && !obj.loaded) {
            targetBase = obj;
            console.log(`找到可接收的基座: ${JSON.stringify(obj)}`);
            break;
        }
    }
    
    if (targetBase) {
        // 向基座脱离
        console.log(`向基座脱离方块: ${crane.hookLoadedBlockType}`);
        
        // 更新基座状态
        gameState.machines[targetBase.craneIndex].baseLoaded = true;
        gameState.machines[targetBase.craneIndex].baseLoadedBlockType = crane.hookLoadedBlockType;
        
        // 清空吊钩
        const blockName = getBlockName(crane.hookLoadedBlockType);
        crane.hookLoaded = false;
        crane.hookLoadedBlockType = null;
        
        gameState.message = `将${blockName}方块脱离到基座`;
        console.log(`操作成功: ${gameState.message}`);
    } else {
        // 检查是否可以脱离到世界
        // 临时将吊钩设为未装载，以避免自身阻挡
        crane.hookLoaded = false;
        
        // 检查位置是否为空气
        const worldBlock = gameState.world[crane.hookY][crane.x];
        if (worldBlock !== BLOCK_TYPES.AIR) {
            // 恢复吊钩状态
            crane.hookLoaded = true;
            console.log('错误: 目标位置已有方块，无法脱离');
            gameState.message = '无法脱离！位置已有方块';
            renderWorld();
            updateMachinesList();
            return;
        }
        
        // 脱离到世界中
        console.log(`向世界脱离方块: ${crane.hookLoadedBlockType}`);
        gameState.world[crane.hookY][crane.x] = crane.hookLoadedBlockType;
        
        const blockName = getBlockName(crane.hookLoadedBlockType);
        crane.hookLoadedBlockType = null;
        // 吊钩已经在前面设置为未装载
        
        gameState.message = `脱离了${blockName}方块`;
        console.log(`操作成功: ${gameState.message}`);
    }
    
    incrementOperationCount();
    renderWorld();
    updateMachinesList();
}

// Demolish the crane
function demolishCrane() {
    if (gameState.selectedMachine === null || 
        gameState.machines[gameState.selectedMachine].type !== MACHINE_TYPES.CRANE) {
        return;
    }
    
    const crane = gameState.machines[gameState.selectedMachine];
    
    // 检查吊钩是否在基座位置
    if (crane.hookY !== crane.y) {
        gameState.message = '吊钩必须回到基座高度才能拆除！';
        renderWorld();
        return;
    }
    
    // 检查吊钩和基座是否都没有装载方块
    if (crane.hookLoaded || crane.baseLoaded) {
        gameState.message = '起重机必须卸下所有方块才能拆除！';
        renderWorld();
        return;
    }
    
    // Return the wood resources
    gameState.resources.wood += 2;
    
    // Remove the crane
    gameState.machines.splice(gameState.selectedMachine, 1);
    gameState.selectedMachine = null;
    
    vehicleControlsElement.style.display = 'none';
    craneControlsElement.style.display = 'none';
    
    gameState.message = '起重机已拆除，返还2个原木';
    renderWorld();
    updateMachinesList();
}

// Try to grow new trees
function tryGrowTrees() {
    // 每10次操作尝试生长一次树
    if (gameState.operationCount % 10 !== 0) {
        return;
    }
    
    const possiblePositions = [];
    
    // 计算当前树木数量，用于调整生长概率
    let currentTreeCount = 0;
    for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let x = 0; x < WORLD_WIDTH; x++) {
            if (gameState.world[y][x] === BLOCK_TYPES.TREE) {
                currentTreeCount++;
            }
        }
    }
    
    // 基础生长概率为20%，每棵现有的树增加5%的概率，最高80%
    const growthProbability = Math.min(0.2 + (currentTreeCount * 0.05), 0.8);
    
    // 找到所有可以种树的位置
    for (let x = 0; x < WORLD_WIDTH; x++) {
        for (let y = 1; y < WORLD_HEIGHT - 1; y++) {  // 从上往下检查，跳过最顶行和最底行
            // 检查是否有机械在这个位置
            let hasMachine = false;
            for (const machine of gameState.machines) {
                if (machine.x === x && machine.y === y) {
                    hasMachine = true;
                    break;
                }
            }
            
            if (hasMachine) continue;
            
            // 检查当前位置是否适合种树：
            // 1. 当前位置是空气
            // 2. 下方是泥土
            // 3. 上方全是空气
            if (gameState.world[y][x] === BLOCK_TYPES.AIR &&
                gameState.world[y + 1][x] === BLOCK_TYPES.DIRT) {
                
                // 检查上方是否全是空气
                let allAirAbove = true;
                for (let checkY = 0; checkY < y; checkY++) {
                    if (gameState.world[checkY][x] !== BLOCK_TYPES.AIR) {
                        allAirAbove = false;
                        break;
                    }
                }
                
                // 检查附近是否有树（左右2格范围内）
                let hasNearbyTree = false;
                for (let dx = -2; dx <= 2; dx++) {
                    const checkX = x + dx;
                    if (checkX >= 0 && checkX < WORLD_WIDTH) {
                        for (let dy = -2; dy <= 2; dy++) {
                            const checkY = y + dy;
                            if (checkY >= 0 && checkY < WORLD_HEIGHT &&
                                gameState.world[checkY][checkX] === BLOCK_TYPES.TREE) {
                                hasNearbyTree = true;
                                break;
                            }
                        }
                    }
                    if (hasNearbyTree) break;
                }
                
                if (allAirAbove && hasNearbyTree) {
                    possiblePositions.push({x, y});
                }
            }
        }
    }
    
    // 如果有可用位置，按概率生成一棵树
    if (possiblePositions.length > 0 && Math.random() < growthProbability) {
        const randomIndex = Math.floor(Math.random() * possiblePositions.length);
        const position = possiblePositions[randomIndex];
        gameState.world[position.y][position.x] = BLOCK_TYPES.TREE;
        gameState.message = '一棵新的树长出来了！';
    }
}

// Increment operation count and update display
function incrementOperationCount() {
    gameState.operationCount++;
    operationCountElement.textContent = gameState.operationCount;
    tryGrowTrees();
    renderWorld();
    updateMachinesList();
}

// 新增：通用检查函数
function getBlockAtPosition(x, y) {
    // 检查世界边界
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) {
        return null;
    }
    return gameState.world[y][x];
}
// Smart load vehicle
function smartLoadVehicle() {
    if (gameState.selectedMachine === null || 
        gameState.machines[gameState.selectedMachine].type !== MACHINE_TYPES.VEHICLE) {
        return;
    }

    // 根据移动方向选择装载位置
    const preferredDirection = gameState.lastMoveDirection || 'right';
    
    // 先尝试优先方向
    loadVehicle(preferredDirection);
    
    // 如果优先方向失败，尝试另一个方向
    if (gameState.message && gameState.message.includes('没有可装载的内容')) {
        loadVehicle(preferredDirection === 'left' ? 'right' : 'left');
    }
}

// Smart unload vehicle
function smartUnloadVehicle(reverse = false) {
    if (gameState.selectedMachine === null || 
        gameState.machines[gameState.selectedMachine].type !== MACHINE_TYPES.VEHICLE) {
        return;
    }
    
    // 根据移动方向和是否反向选择优先方向
    const moveDirection = gameState.lastMoveDirection || 'right';
    const preferredDirection = reverse ? 
        (moveDirection === 'left' ? 'right' : 'left') : 
        moveDirection;
    
    // 先尝试优先方向
    unloadVehicle(preferredDirection);
    
    // 如果优先方向失败，尝试另一个方向
    if (gameState.message && gameState.message.includes('无法卸载')) {
        unloadVehicle(preferredDirection === 'left' ? 'right' : 'left');
    }
}

// Initialize the game when the page loads
window.addEventListener('load', initGame); 