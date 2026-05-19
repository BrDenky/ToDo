const API_URL = '/api/';

const timers = {};
let globalInterval = null;
let allTasks = [];
let currentAnchoredTask = null;

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
    
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    const timerState = timers[task.id];
    const displayTime = formatTime(timerState.timeLeft);
    const playPauseIcon = timerState.isRunning ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
    const activeClass = timerState.isRunning ? 'active' : '';

    const detailContent = document.getElementById('detailContent');
    document.getElementById('detailTitle').textContent = "Detalles de la Tarea";
    
    detailContent.innerHTML = `
        <h1 class="detail-task-title">${task.Titulo}</h1>
        <div class="detail-task-meta">
            <span class="task-date"><i class="fa-regular fa-calendar-days"></i> ${task.Fecha}</span>
            <span class="task-status ${task.Completado ? 'completed' : ''}">${task.Completado ? 'Completada ✅' : 'Pendiente ⏳'}</span>
        </div>
        
        <div class="detail-task-desc-box">
            <h3>Descripción</h3>
            <p>${task.Descripcion || 'Sin descripción provista.'}</p>
        </div>

        <div class="pomodoro-container detail-pomo">
            <div class="pomodoro-display">
                <span id="pomo-display-detail-${task.id}" class="editable-time detail-time"
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
    `;
    
    document.querySelectorAll('.todo-item').forEach(item => item.classList.remove('selected-task'));
    const taskLi = document.getElementById(`task-item-${taskId}`);
    if (taskLi) taskLi.classList.add('selected-task');
};

window.closeDetail = function() {
    currentAnchoredTask = null;
    document.getElementById('appLayout').classList.remove('anchored');
    document.querySelectorAll('.todo-item').forEach(item => item.classList.remove('selected-task'));
};
