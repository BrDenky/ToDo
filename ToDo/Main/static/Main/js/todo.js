const API_URL = '/api/';

const timers = {};
let globalInterval = null;
let allTasks = [];
let currentAnchoredTask = null;

window.formatDoc = function(cmd, value = null) {
    document.execCommand(cmd, false, value);
    const docsEditor = document.getElementById('docsEditor');
    if (docsEditor) {
        docsEditor.focus();
        docsEditor.dispatchEvent(new Event('input'));
    }
};

document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    
    const form = document.getElementById('todoForm');
    if (form) {
        form.addEventListener('submit', addTask);
    }
    if (!globalInterval) {
        globalInterval = setInterval(() => {
            for (const taskId in timers) {
                const timer = timers[taskId];
                if (timer.isRunning) {
                    if (timer.timeLeft > 0) {
                        timer.timeLeft--;
                        const displayElement = document.getElementById(`pomo-display-${taskId}`);
                        if (displayElement) {
                            displayElement.textContent = formatTime(timer.timeLeft);
                        }
                        const displayDetail = document.getElementById(`pomo-display-detail-${taskId}`);
                        if (displayDetail) displayDetail.textContent = formatTime(timer.timeLeft);
                    } else {
                        timer.isRunning = false;
                        timer.sessions = (timer.sessions || 0) + 1; // Incrementar sesiones
                        [document.getElementById(`pomo-display-${taskId}`), document.getElementById(`pomo-display-detail-${taskId}`)].forEach(el => {
                            if (el) el.textContent = "00:00";
                        });
                        document.querySelectorAll(`button[onclick="togglePomo(${taskId})"]`).forEach(btn => {
                            btn.innerHTML = '<i class="fa-solid fa-play"></i>';
                            btn.classList.remove('active');
                        });
                        [document.getElementById(`pomo-sessions-${taskId}`), document.getElementById(`pomo-sessions-detail-${taskId}`)].forEach(el => {
                            if (el) el.textContent = timer.sessions;
                        });
                        // Optional alert for completion
                        // alert("¡Pomodoro completado!"); 
                    }
                }
            }
        }, 1000);
    }
});

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}


async function loadTasks() {
    try {
        const response = await fetch(API_URL);
        allTasks = await response.json();
        renderTasks(allTasks);
        if (currentAnchoredTask) {
            anchorTask(currentAnchoredTask);
        }
    } catch (error) {
        console.error("Error cargando tareas:", error);
    }
}

function renderTasks(tasks) {
    const list = document.getElementById('todoList');
    list.innerHTML = '';

    // Ordenar: primero no completadas, luego completadas
    tasks.sort((a, b) => a.Completado - b.Completado);

    tasks.forEach(task => {
        if (!timers[task.id]) {
            timers[task.id] = {
                timeLeft: 25 * 60, // 25 minutes default
                configuredTime: 25,
                isRunning: false,
                sessions: 0 // Iniciar contador de sesiones
            };
        }
        
        const li = document.createElement('li');
        li.className = `todo-item ${task.Completado ? 'completed' : ''}`;
        li.id = `task-item-${task.id}`;
        if (currentAnchoredTask === task.id) li.classList.add('selected-task');
        
        li.onclick = (e) => {
            if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.editable-time')) {
                return;
            }
            if (document.getElementById('appLayout').classList.contains('anchored')) {
                anchorTask(task.id);
            }
        };

        const timerState = timers[task.id];
        const displayTime = formatTime(timerState.timeLeft);
        const playPauseIcon = timerState.isRunning ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
        const activeClass = timerState.isRunning ? 'active' : '';

        li.innerHTML = `
            <div class="task-info">
                <h3 class="task-title">${task.Titulo}</h3>
                <p class="task-desc">${task.Descripcion || 'Sin descripción'}</p>
                <span class="task-date"><i class="fa-regular fa-calendar-days"></i> ${task.Fecha}</span>
            </div>
            <div class="pomodoro-container">
                <div class="pomodoro-display">
                    <span id="pomo-display-${task.id}" class="editable-time"
                          ${(!task.Completado && !timerState.isRunning) ? 'contenteditable="true"' : ''} 
                          onblur="parsePomoTime(${task.id}, this.innerText)" 
                          onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}"
                          title="Haz clic para editar los minutos">${displayTime}</span>
                </div>
                <div class="pomodoro-controls">
                    <button class="btn-icon pomo-btn ${activeClass}" onclick="togglePomo(${task.id})" title="Iniciar/Pausar" ${task.Completado ? 'disabled' : ''}>
                        ${playPauseIcon}
                    </button>
                    <button class="btn-icon pomo-btn" onclick="resetPomo(${task.id})" title="Reiniciar" ${task.Completado ? 'disabled' : ''}>
                        <i class="fa-solid fa-rotate-right"></i>
                    </button>
                    <div class="pomodoro-sessions" title="Sesiones completadas">
                        🍅 <span id="pomo-sessions-${task.id}">${timerState.sessions}</span>
                    </div>
                </div>
            </div>
            <div class="task-actions">
                <button class="btn-icon btn-complete" onclick="toggleTask(${task.id}, ${task.Completado}, '${task.Titulo}', '${task.Descripcion}', '${task.Fecha}')" title="${task.Completado ? 'Desmarcar' : 'Completar'}">
                    ${task.Completado ? '<i class="fa-solid fa-rotate-left"></i>' : '<i class="fa-solid fa-check"></i>'}
                </button>
                <button class="btn-icon btn-delete" onclick="deleteTask(${task.id})" title="Eliminar">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
                <button class="btn-icon btn-anchor" onclick="anchorTask(${task.id})" title="Ver Detalles">
                    <i class="fa-solid fa-anchor"></i>
                </button>
            </div>
        `;
        list.appendChild(li);
    });
}

async function addTask(e) {
    e.preventDefault();
    const title = document.getElementById('taskTitle').value;
    const desc = document.getElementById('taskDesc').value;
    const date = document.getElementById('taskDate').value;

    const newTask = {
        Titulo: title,
        Descripcion: desc,
        Fecha: date,
        Completado: false
    };

    try {
        const response = await fetch(`${API_URL}create/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTask)
        });

        if (response.ok) {
            document.getElementById('todoForm').reset();
            loadTasks();
        }
    } catch (error) {
        console.error("Error agregando tarea:", error);
    }
}

async function toggleTask(id, isCompleted, title, desc, date) {
    const updatedTask = {
        Titulo: title,
        Descripcion: desc,
        Fecha: date,
        Completado: !isCompleted
    };

    try {
        await fetch(`${API_URL}${id}/`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedTask)
        });
        loadTasks();
    } catch (error) {
        console.error("Error actualizando tarea:", error);
    }
}

async function deleteTask(id) {
    if (!confirm("¿Estás seguro de que deseas eliminar esta tarea?")) return;

    try {
        await fetch(`${API_URL}delete/${id}/`, {
            method: 'DELETE'
        });
        loadTasks();
    } catch (error) {
        console.error("Error eliminando tarea:", error);
    }
}

window.parsePomoTime = function(taskId, text) {
    const timer = timers[taskId];
    if (!timer || timer.isRunning) return;
    
    let mins = 25;
    if (text.includes(':')) {
        mins = parseInt(text.split(':')[0]);
    } else {
        mins = parseInt(text);
    }
    
    if (isNaN(mins) || mins < 1) mins = 1;
    if (mins > 120) mins = 120;
    
    timer.configuredTime = mins;
    timer.timeLeft = mins * 60;
    
    const displayElement = document.getElementById(`pomo-display-${taskId}`);
    if (displayElement) {
        displayElement.textContent = formatTime(timer.timeLeft);
    }
    const displayDetail = document.getElementById(`pomo-display-detail-${taskId}`);
    if (displayDetail) displayDetail.textContent = formatTime(timer.timeLeft);
}

window.togglePomo = function(taskId) {
    const timer = timers[taskId];
    if (timer) {
        if (timer.timeLeft <= 0) {
            timer.timeLeft = timer.configuredTime * 60;
        }
        timer.isRunning = !timer.isRunning;
        
        [document.getElementById(`pomo-display-${taskId}`), document.getElementById(`pomo-display-detail-${taskId}`)].forEach(displayElement => {
            if (displayElement) {
                if (timer.isRunning) {
                    displayElement.removeAttribute('contenteditable');
                } else {
                    displayElement.setAttribute('contenteditable', 'true');
                }
            }
        });

        document.querySelectorAll(`button[onclick="togglePomo(${taskId})"]`).forEach(btn => {
            if (timer.isRunning) {
                btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                btn.classList.add('active');
            } else {
                btn.innerHTML = '<i class="fa-solid fa-play"></i>';
                btn.classList.remove('active');
            }
        });
    }
};

window.resetPomo = function(taskId) {
    const timer = timers[taskId];
    if (timer) {
        timer.isRunning = false;
        timer.timeLeft = timer.configuredTime * 60;
        
        [document.getElementById(`pomo-display-${taskId}`), document.getElementById(`pomo-display-detail-${taskId}`)].forEach(displayElement => {
            if (displayElement) {
                displayElement.textContent = formatTime(timer.timeLeft);
                displayElement.setAttribute('contenteditable', 'true');
            }
        });
        
        document.querySelectorAll(`button[onclick="togglePomo(${taskId})"]`).forEach(btn => {
            btn.innerHTML = '<i class="fa-solid fa-play"></i>';
            btn.classList.remove('active');
        });
    }
};

window.anchorTask = function(taskId) {
    currentAnchoredTask = taskId;
    const appLayout = document.getElementById('appLayout');
    appLayout.classList.add('anchored');
    const appWrapper = document.getElementById('appWrapper');
    if (appWrapper) {
        appWrapper.classList.add('anchored');
    }
    
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    const timerState = timers[task.id];
    const displayTime = formatTime(timerState.timeLeft);
    const playPauseIcon = timerState.isRunning ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
    const activeClass = timerState.isRunning ? 'active' : '';

    const detailContent = document.getElementById('detailContent');
    
    detailContent.innerHTML = `
        <div class="detail-unified-header">
            <div class="detail-header-left">
                <h2 class="detail-title-text">${task.Titulo} <span class="detail-title-date">(${task.Fecha})</span></h2>
                ${task.Descripcion ? `<p class="detail-desc-text"><strong>Descripción:</strong> ${task.Descripcion}</p>` : ''}
            </div>
            
            <div class="detail-header-right">
                <span class="task-status ${task.Completado ? 'completed' : ''}">${task.Completado ? 'Completada <i class="fa-solid fa-circle-check" style="color: #55efc4; margin-left: 0.4rem;"></i>' : 'Pendiente <i class="fa-regular fa-clock" style="color: #ffeaa7; margin-left: 0.4rem;"></i>'}</span>
                <div class="pomodoro-container detail-pomo-compact">
                    <div class="pomodoro-display">
                        <span id="pomo-display-detail-${task.id}" class="editable-time detail-time-compact"
                              ${(!task.Completado && !timerState.isRunning) ? 'contenteditable="true"' : ''} 
                              onblur="parsePomoTime(${task.id}, this.innerText)" 
                              onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}"
                              title="Haz clic para editar">${displayTime}</span>
                    </div>
                    <div class="pomodoro-controls">
                        <button class="btn-icon pomo-btn ${activeClass}" onclick="togglePomo(${task.id})" title="Iniciar/Pausar" ${task.Completado ? 'disabled' : ''}>
                            ${playPauseIcon}
                        </button>
                        <button class="btn-icon pomo-btn" onclick="resetPomo(${task.id})" title="Reiniciar" ${task.Completado ? 'disabled' : ''}>
                            <i class="fa-solid fa-rotate-right"></i>
                        </button>
                        <div class="pomodoro-sessions" title="Sesiones completadas">
                            🍅 <span id="pomo-sessions-detail-${task.id}">${timerState.sessions}</span>
                        </div>
                    </div>
                </div>
                <button class="btn-icon close-detail-btn" onclick="closeDetail()" title="Cerrar detalles"><i class="fa-solid fa-xmark"></i></button>
            </div>
        </div>

        <div class="docs-editor-container">
            <div class="docs-toolbar">
                <button class="toolbar-btn" onclick="formatDoc('bold')" title="Negrita"><i class="fa-solid fa-bold"></i></button>
                <button class="toolbar-btn" onclick="formatDoc('italic')" title="Cursiva"><i class="fa-solid fa-italic"></i></button>
                <button class="toolbar-btn" onclick="formatDoc('underline')" title="Subrayado"><i class="fa-solid fa-underline"></i></button>
                <button class="toolbar-btn" onclick="formatDoc('justifyLeft')" title="Alinear izquierda"><i class="fa-solid fa-align-left"></i></button>
                <button class="toolbar-btn" onclick="formatDoc('justifyCenter')" title="Centrar"><i class="fa-solid fa-align-center"></i></button>
                <button class="toolbar-btn" onclick="formatDoc('justifyRight')" title="Alinear derecha"><i class="fa-solid fa-align-right"></i></button>
                <button class="toolbar-btn" onclick="formatDoc('insertUnorderedList')" title="Lista con viñetas"><i class="fa-solid fa-list-ul"></i></button>
                <span class="save-status" id="docSaveStatus">Autoguardado <i class="fa-solid fa-cloud-arrow-up"></i></span>
            </div>
            <div class="docs-page-wrapper">
                <div class="docs-page" contenteditable="true" id="docsEditor" placeholder="Empieza a escribir tus apuntes aquí...">
                    ${task.Apuntes || ''}
                </div>
            </div>
        </div>
    `;

    const docsEditor = document.getElementById('docsEditor');
    const saveStatus = document.getElementById('docSaveStatus');
    let saveTimeout = null;

    if (docsEditor) {
        docsEditor.addEventListener('input', () => {
            if (saveStatus) {
                saveStatus.innerHTML = 'Guardando... <i class="fa-solid fa-spinner fa-spin"></i>';
            }
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(async () => {
                const newNotes = docsEditor.innerHTML;
                try {
                    await fetch(`${API_URL}${taskId}/`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ Apuntes: newNotes })
                    });
                    
                    const taskToUpdate = allTasks.find(t => t.id === taskId);
                    if (taskToUpdate) {
                        taskToUpdate.Apuntes = newNotes;
                    }
                    
                    if (saveStatus) {
                        saveStatus.innerHTML = 'Autoguardado <i class="fa-solid fa-cloud-arrow-up"></i>';
                    }
                } catch (error) {
                    console.error("Error saving document:", error);
                    if (saveStatus) {
                        saveStatus.innerHTML = '<span style="color: var(--secondary)">Error de guardado <i class="fa-solid fa-triangle-exclamation"></i></span>';
                    }
                }
            }, 1000);
        });
    }
    
    document.querySelectorAll('.todo-item').forEach(item => item.classList.remove('selected-task'));
    const taskLi = document.getElementById(`task-item-${taskId}`);
    if (taskLi) taskLi.classList.add('selected-task');
};

window.closeDetail = function() {
    currentAnchoredTask = null;
    document.getElementById('appLayout').classList.remove('anchored');
    const appWrapper = document.getElementById('appWrapper');
    if (appWrapper) {
        appWrapper.classList.remove('anchored');
    }
    document.querySelectorAll('.todo-item').forEach(item => item.classList.remove('selected-task'));
};
