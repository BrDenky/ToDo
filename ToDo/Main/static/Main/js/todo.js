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

    const quickAddBtn = document.getElementById('addQuickTaskBtn');
    if (quickAddBtn) {
        quickAddBtn.addEventListener('click', addQuickTask);
    }

    const todoList = document.getElementById('todoList');
    if (todoList) {
        todoList.addEventListener('contextmenu', (e) => {
            const item = e.target.closest('.todo-item');
            if (!item) return;

            e.preventDefault();
            const taskId = parseInt(item.id.replace('task-item-', ''));
            showContextMenu(e.clientX, e.clientY, taskId);
        });
    }

    const ctxDuplicate = document.getElementById('ctxDuplicate');
    if (ctxDuplicate) {
        ctxDuplicate.addEventListener('click', async () => {
            if (activeContextTaskId) {
                await duplicateTask(activeContextTaskId);
            }
            hideContextMenu();
        });
    }

    const ctxDelete = document.getElementById('ctxDelete');
    if (ctxDelete) {
        ctxDelete.addEventListener('click', async () => {
            if (activeContextTaskId) {
                await deleteTask(activeContextTaskId);
            }
            hideContextMenu();
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#contextMenu')) {
            hideContextMenu();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideContextMenu();
        }
    });

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
                <h2 class="detail-title-text">
                    <span id="detailTitleText" title="Doble clic para editar">${task.Titulo}</span> 
                    <span class="detail-title-date">(${task.Fecha})</span>
                </h2>
                <p class="detail-desc-text" id="detailDescContainer" title="Doble clic para editar">
                    <strong>Descripción:</strong> <span id="detailDescText">${task.Descripcion || 'Sin descripción'}</span>
                </p>
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
                
                <div class="highlight-container">
                    <button class="toolbar-btn highlight-btn" id="highlightBtn" title="Resaltar texto (Tecla 'S')">
                        <i class="fa-solid fa-highlighter"></i>
                    </button>
                    <div class="pastel-colors-dropdown" id="pastelColorsDropdown">
                        <span class="pastel-color-dot active" data-color="#fef08a" style="background-color: #fef08a;" title="Amarillo pastel"></span>
                        <span class="pastel-color-dot" data-color="#bbf7d0" style="background-color: #bbf7d0;" title="Verde pastel"></span>
                        <span class="pastel-color-dot" data-color="#bfdbfe" style="background-color: #bfdbfe;" title="Azul pastel"></span>
                        <span class="pastel-color-dot" data-color="#fbcfe8" style="background-color: #fbcfe8;" title="Rosa pastel"></span>
                        <span class="pastel-color-dot" data-color="#e9d5ff" style="background-color: #e9d5ff;" title="Morado pastel"></span>
                        <span class="pastel-color-dot clear-color" data-color="transparent" title="Quitar resaltado"><i class="fa-solid fa-eraser"></i></span>
                    </div>
                </div>

                <button class="toolbar-btn" onclick="insertTable()" title="Insertar tabla (2x3)"><i class="fa-solid fa-table"></i></button>
                
                <button class="toolbar-btn voice-btn" id="voiceBtn" title="Dictado por voz (Próximamente)" style="opacity: 0.5; cursor: not-allowed;">
                    <i class="fa-solid fa-microphone"></i>
                </button>

                <button class="toolbar-btn" onclick="formatDoc('justifyLeft')" title="Alinear izquierda"><i class="fa-solid fa-align-left"></i></button>
                <button class="toolbar-btn" onclick="formatDoc('justifyCenter')" title="Centrar"><i class="fa-solid fa-align-center"></i></button>
                <button class="toolbar-btn" onclick="formatDoc('justifyRight')" title="Alinear derecha"><i class="fa-solid fa-align-right"></i></button>
                <button class="toolbar-btn" onclick="formatDoc('insertUnorderedList')" title="Lista con viñetas"><i class="fa-solid fa-list-ul"></i></button>
                <span class="save-status" id="docSaveStatus">Autoguardado <i class="fa-solid fa-cloud-arrow-up"></i></span>
            </div>
            <div class="docs-editor-body">
                <div class="docs-page-wrapper">
                    <div class="docs-page" contenteditable="true" id="docsEditor" placeholder="Empieza a escribir tus apuntes aquí...">
                        ${task.Apuntes || ''}
                    </div>
                </div>
                <div id="docsOutline" class="docs-outline"></div>
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
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = docsEditor.innerHTML;
                tempDiv.querySelectorAll('.table-add-col-btn, .table-add-row-btn, .table-add-row-bar, .table-add-col-bar, .table-col-handle, .table-row-handle, .selected-table-cell').forEach(el => {
                    if (el.classList.contains('selected-table-cell')) {
                        el.classList.remove('selected-table-cell');
                    } else {
                        el.remove();
                    }
                });
                const newNotes = tempDiv.innerHTML;
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

        // Configuración de Resaltador
        let activeHighlightColor = '#fef08a';
        
        // Evitar que el editor pierda el foco y la selección al hacer clic en botones de la barra de herramientas o colores
        const toolbarInteractives = document.querySelectorAll('.docs-toolbar button, .pastel-color-dot');
        toolbarInteractives.forEach(el => {
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });
        });

        const colorDots = document.querySelectorAll('.pastel-color-dot');
        colorDots.forEach(dot => {
            dot.addEventListener('click', (e) => {
                colorDots.forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                activeHighlightColor = dot.getAttribute('data-color');
                
                const selection = window.getSelection();
                if (selection && !selection.isCollapsed) {
                    applyHighlight(activeHighlightColor);
                }
            });
        });

        const highlightBtn = document.getElementById('highlightBtn');
        if (highlightBtn) {
            highlightBtn.addEventListener('click', () => {
                applyHighlight(activeHighlightColor);
            });
        }

        // Atajos de teclado en el editor
        docsEditor.addEventListener('keydown', (e) => {
            // Atajo teclado letra 'S' para resaltar (subrayar) con color pastel
            if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.altKey && !e.metaKey) {
                const selection = window.getSelection();
                if (selection && !selection.isCollapsed) {
                    const range = selection.getRangeAt(0);
                    if (docsEditor.contains(range.commonAncestorContainer)) {
                        e.preventDefault();
                        applyHighlight(activeHighlightColor);
                    }
                }
            }

            // Atajo teclado Backspace al inicio de un título para revertirlo a párrafo normal
            if (e.key === 'Backspace') {
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    if (range.collapsed) {
                        const parent = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentNode : range.startContainer;
                        const heading = parent.closest('h1, h2, h3');
                        if (heading && docsEditor.contains(heading)) {
                            const headingRange = document.createRange();
                            headingRange.selectNodeContents(heading);
                            headingRange.collapse(true);
                            if (range.compareBoundaryPoints(Range.START_TO_START, headingRange) === 0) {
                                e.preventDefault();
                                const div = document.createElement('div');
                                div.innerHTML = heading.innerHTML;
                                if (div.innerHTML === '' || div.innerHTML === '<br>') {
                                    div.innerHTML = '<br>';
                                }
                                heading.parentNode.replaceChild(div, heading);
                                
                                const newRange = document.createRange();
                                newRange.selectNodeContents(div);
                                newRange.collapse(true);
                                selection.removeAllRanges();
                                selection.addRange(newRange);
                                
                                docsEditor.dispatchEvent(new Event('input'));
                            }
                        }
                    }
                }
            }
        });

        // Markdown headings detector and Outline generator
        docsEditor.addEventListener('input', () => {
            parseMarkdownHeadings();
            updateOutline();
        });

        // Carga inicial de outline
        setTimeout(() => {
            parseMarkdownHeadings();
            updateOutline();
        }, 100);
    }

    // Habilitar edición al hacer doble click en el Título
    const titleText = document.getElementById('detailTitleText');
    if (titleText) {
        titleText.addEventListener('dblclick', () => {
            if (titleText.getAttribute('contenteditable') === 'true') return;

            const originalVal = task.Titulo;
            titleText.setAttribute('contenteditable', 'true');
            titleText.focus();

            // Seleccionar todo el texto
            const range = document.createRange();
            range.selectNodeContents(titleText);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);

            const saveTitle = async () => {
                titleText.removeAttribute('contenteditable');
                const newVal = titleText.textContent.trim() || originalVal;
                titleText.textContent = newVal;
                if (newVal !== originalVal) {
                    task.Titulo = newVal;
                    await updateTaskField(taskId, { Titulo: newVal });
                }
            };

            const onKeyDown = (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    titleText.blur();
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    titleText.textContent = originalVal;
                    titleText.blur();
                }
            };

            titleText.addEventListener('blur', saveTitle, { once: true });
            titleText.addEventListener('keydown', onKeyDown);
            titleText.addEventListener('blur', () => {
                titleText.removeEventListener('keydown', onKeyDown);
            }, { once: true });
        });
    }

    // Habilitar edición al hacer doble click en la Descripción
    const descText = document.getElementById('detailDescText');
    if (descText) {
        descText.addEventListener('dblclick', () => {
            if (descText.getAttribute('contenteditable') === 'true') return;

            const originalVal = task.Descripcion || '';
            if (descText.textContent === 'Sin descripción') {
                descText.textContent = '';
            }
            descText.setAttribute('contenteditable', 'true');
            descText.focus();

            // Seleccionar todo el texto
            const range = document.createRange();
            range.selectNodeContents(descText);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);

            const saveDesc = async () => {
                descText.removeAttribute('contenteditable');
                const newVal = descText.textContent.trim();
                descText.textContent = newVal || 'Sin descripción';
                if (newVal !== originalVal) {
                    task.Descripcion = newVal;
                    await updateTaskField(taskId, { Descripcion: newVal });
                }
            };

            const onKeyDown = (event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    descText.blur();
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    descText.textContent = originalVal || 'Sin descripción';
                    descText.blur();
                }
            };

            descText.addEventListener('blur', saveDesc, { once: true });
            descText.addEventListener('keydown', onKeyDown);
            descText.addEventListener('blur', () => {
                descText.removeEventListener('keydown', onKeyDown);
            }, { once: true });
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

// Variables y Funciones para el Menú Contextual y Agregar Tarea Rápida
let activeContextTaskId = null;

function showContextMenu(x, y, taskId) {
    activeContextTaskId = taskId;
    const menu = document.getElementById('contextMenu');
    if (!menu) return;

    menu.style.display = 'block';

    const menuWidth = menu.offsetWidth || 170;
    const menuHeight = menu.offsetHeight || 120;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    if (x + menuWidth > windowWidth) {
        x = windowWidth - menuWidth - 10;
    }
    if (y + menuHeight > windowHeight) {
        y = windowHeight - menuHeight - 10;
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
}

function hideContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (menu) {
        menu.style.display = 'none';
    }
    activeContextTaskId = null;
}

async function addQuickTask() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const newTask = {
        Titulo: "Nueva Tarea",
        Descripcion: "Descripción de la tarea",
        Fecha: dateStr,
        Completado: false
    };

    try {
        const response = await fetch(`${API_URL}create/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTask)
        });

        if (response.ok) {
            const createdTask = await response.json();
            await loadTasks();
            anchorTask(createdTask.id);
        }
    } catch (error) {
        console.error("Error agregando tarea rápida:", error);
    }
}

async function duplicateTask(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    const duplicatedTask = {
        Titulo: `${task.Titulo} (Copia)`,
        Descripcion: task.Descripcion,
        Fecha: task.Fecha,
        Completado: task.Completado,
        DuracionPomodoro: task.DuracionPomodoro,
        PomodorosCompletados: task.PomodorosCompletados,
        PomodorosEsperados: task.PomodorosEsperados,
        Apuntes: task.Apuntes
    };

    try {
        const response = await fetch(`${API_URL}create/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(duplicatedTask)
        });

        if (response.ok) {
            loadTasks();
        }
    } catch (error) {
        console.error("Error duplicando tarea:", error);
    }
}

async function updateTaskField(taskId, fields) {
    try {
        const response = await fetch(`${API_URL}${taskId}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields)
        });
        if (response.ok) {
            await loadTasks();
        }
    } catch (error) {
        console.error("Error actualizando campo de la tarea:", error);
    }
}

window.insertTable = function() {
    const tableHtml = `
        <table class="docs-table">
            <thead>
                <tr>
                    <th><br></th>
                    <th><br></th>
                    <th><br></th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><br></td>
                    <td><br></td>
                    <td><br></td>
                </tr>
            </tbody>
        </table>
        <p><br></p>
    `;
    document.execCommand('insertHTML', false, tableHtml);
    const docsEditor = document.getElementById('docsEditor');
    if (docsEditor) {
        docsEditor.focus();
        docsEditor.dispatchEvent(new Event('input'));
    }
};

window.addTableColumn = function(table) {
    const rows = table.rows;
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const newCell = document.createElement(i === 0 ? 'th' : 'td');
        newCell.innerHTML = '<br>';
        row.appendChild(newCell);
    }
    
    // Equalize column widths in percentage
    const firstRow = table.rows[0];
    if (firstRow) {
        const cells = Array.from(firstRow.cells);
        const count = cells.length;
        cells.forEach(c => {
            c.style.width = (100 / count) + '%';
        });
    }

    const docsEditor = document.getElementById('docsEditor');
    if (docsEditor) docsEditor.dispatchEvent(new Event('input'));
};

window.addTableRow = function(table) {
    const colCount = table.rows[0].cells.length;
    const newRow = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
        const newCell = document.createElement('td');
        newCell.innerHTML = '<br>';
        newRow.appendChild(newCell);
    }
    table.querySelector('tbody') ? table.querySelector('tbody').appendChild(newRow) : table.appendChild(newRow);
    const docsEditor = document.getElementById('docsEditor');
    if (docsEditor) docsEditor.dispatchEvent(new Event('input'));
};

window.removeTableHelpers = function(table) {
    if (!table) return;
    table.querySelectorAll('.table-col-handle, .table-row-handle, .table-add-row-bar, .table-add-col-bar').forEach(el => el.remove());
};

window.applyHighlight = function(color) {
    document.execCommand('hiliteColor', false, color);
    const docsEditor = document.getElementById('docsEditor');
    if (docsEditor) {
        docsEditor.focus();
        docsEditor.dispatchEvent(new Event('input'));
    }
};

window.parseMarkdownHeadings = function() {
    const editor = document.getElementById('docsEditor');
    if (!editor) return;

    let changed = false;
    const children = Array.from(editor.childNodes);

    children.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (text.trim() === '') return;
            const div = document.createElement('div');
            div.textContent = text;
            editor.replaceChild(div, node);
            node = div;
            changed = true;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toUpperCase();
            const isHeading = ['H1', 'H2', 'H3'].includes(tagName);
            if (tagName === 'DIV' || tagName === 'P' || isHeading) {
                const text = node.textContent;
                let headingTag = null;
                let cleanText = '';

                if (text.startsWith('# ')) {
                    headingTag = 'H1';
                    cleanText = text.substring(2);
                } else if (text.startsWith('## ')) {
                    headingTag = 'H2';
                    cleanText = text.substring(3);
                } else if (text.startsWith('### ')) {
                    headingTag = 'H3';
                    cleanText = text.substring(4);
                }

                if (headingTag) {
                    if (!isHeading || headingTag !== tagName) {
                        const headingEl = document.createElement(headingTag);
                        headingEl.textContent = cleanText;
                        if (headingEl.textContent.trim() === '') {
                            headingEl.innerHTML = '<br>';
                        }
                        
                        const selection = window.getSelection();
                        let isFocusedNode = false;
                        let offset = 0;
                        if (selection && selection.rangeCount > 0) {
                            const range = selection.getRangeAt(0);
                            isFocusedNode = (range.startContainer === node || node.contains(range.startContainer));
                            offset = range.startOffset;
                        }

                        editor.replaceChild(headingEl, node);
                        changed = true;

                        if (isFocusedNode) {
                            const newRange = document.createRange();
                            const textNode = headingEl.firstChild || headingEl;
                            const newOffset = Math.max(0, offset - (text.length - cleanText.length));
                            try {
                                newRange.setStart(textNode, Math.min(newOffset, textNode.length || 0));
                                newRange.collapse(true);
                            } catch (e) {
                                newRange.selectNodeContents(headingEl);
                                newRange.collapse(false);
                            }
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                        }
                    }
                }
            }
        }
    });

    if (changed) {
        editor.dispatchEvent(new Event('input'));
    }
};

window.updateOutline = function() {
    const editor = document.getElementById('docsEditor');
    const outline = document.getElementById('docsOutline');
    if (!editor || !outline) return;

    outline.innerHTML = '';

    const headings = editor.querySelectorAll('h1, h2, h3');
    if (headings.length === 0) return;

    const barsWrapper = document.createElement('div');
    barsWrapper.className = 'outline-bars-wrapper';

    const dropdown = document.createElement('div');
    dropdown.className = 'outline-dropdown';
    dropdown.contentEditable = 'false';

    const header = document.createElement('div');
    header.className = 'outline-dropdown-header';
    header.textContent = 'Índice de contenido';
    dropdown.appendChild(header);

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'outline-dropdown-items';
    dropdown.appendChild(itemsContainer);

    headings.forEach((heading, index) => {
        if (!heading.id) {
            heading.id = `heading-${Date.now()}-${index}`;
        }

        const level = heading.tagName.toLowerCase();

        // 1. Create the mini bar
        const bar = document.createElement('div');
        bar.className = `outline-bar ${level}`;
        bar.onclick = (e) => {
            e.stopPropagation();
            heading.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            heading.style.transition = 'background-color 0.5s';
            heading.style.backgroundColor = 'var(--heading-flash-bg)';
            setTimeout(() => {
                heading.style.backgroundColor = '';
            }, 1000);
        };
        barsWrapper.appendChild(bar);

        // 2. Create the dropdown item
        const item = document.createElement('div');
        item.className = `outline-dropdown-item ${level}`;
        item.textContent = heading.textContent.trim() || heading.tagName;
        item.title = heading.textContent.trim();
        item.onclick = (e) => {
            e.stopPropagation();
            heading.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            heading.style.transition = 'background-color 0.5s';
            heading.style.backgroundColor = 'var(--heading-flash-bg)';
            setTimeout(() => {
                heading.style.backgroundColor = '';
            }, 1000);
        };
        itemsContainer.appendChild(item);
    });

    outline.appendChild(barsWrapper);
    outline.appendChild(dropdown);
};

// --- Table and Image Interaction System ---
let activeHoveredCell = null;
let activeTableSelection = null;
let isResizingColumn = false;
let isDraggingCol = false;
let isDraggingRow = false;
let dragStartIndex = -1;
let activeDragTable = null;

// Helpers to clear selection highlight
window.clearTableSelection = function() {
    if (activeTableSelection) {
        activeTableSelection.cells.forEach(c => c.classList.remove('selected-table-cell'));
        activeTableSelection = null;
    }
};

// Select Column
window.selectTableColumn = function(table, colIndex) {
    window.clearTableSelection();
    const cells = [];
    for (let r = 0; r < table.rows.length; r++) {
        const cell = table.rows[r].cells[colIndex];
        if (cell) {
            cell.classList.add('selected-table-cell');
            cells.push(cell);
        }
    }
    activeTableSelection = {
        type: 'column',
        table: table,
        index: colIndex,
        cells: cells
    };
};

// Select Row
window.selectTableRow = function(table, rowIndex) {
    window.clearTableSelection();
    const row = table.rows[rowIndex];
    if (!row) return;
    const cells = Array.from(row.cells);
    cells.forEach(c => c.classList.add('selected-table-cell'));
    activeTableSelection = {
        type: 'row',
        table: table,
        index: rowIndex,
        cells: cells
    };
};

// Mouse Hover and Motion Listener for Table Controls
document.addEventListener('mouseover', (e) => {
    if (isResizingColumn || isDraggingCol || isDraggingRow) return;

    const cell = e.target.closest('#docsEditor td, #docsEditor th');
    if (!cell) {
        // If hovered completely outside any table, remove handles
        const table = e.target.closest('#docsEditor table');
        if (!table) {
            document.querySelectorAll('#docsEditor table').forEach(t => {
                t.querySelectorAll('.table-col-handle, .table-row-handle').forEach(h => h.remove());
            });
            activeHoveredCell = null;
        }
        return;
    }

    activeHoveredCell = cell;
    const table = cell.closest('table');
    if (!table) return;

    const rowIndex = cell.parentElement.rowIndex;
    const colIndex = cell.cellIndex;

    // Remove any handles in this table
    table.querySelectorAll('.table-col-handle, .table-row-handle').forEach(h => h.remove());

    // Create & append Notion-style hover bars (once)
    if (!table.querySelector('.table-add-row-bar')) {
        const rowBar = document.createElement('div');
        rowBar.className = 'table-add-row-bar';
        rowBar.contentEditable = 'false';
        rowBar.innerHTML = `
            <div class="table-add-row-line"></div>
            <div class="table-add-row-btn"><i class="fa-solid fa-plus"></i></div>
        `;
        rowBar.onclick = (event) => {
            event.stopPropagation();
            event.preventDefault();
            window.addTableRow(table);
        };
        table.appendChild(rowBar);
    }
    if (!table.querySelector('.table-add-col-bar')) {
        const colBar = document.createElement('div');
        colBar.className = 'table-add-col-bar';
        colBar.contentEditable = 'false';
        colBar.innerHTML = `
            <div class="table-add-col-line"></div>
            <div class="table-add-col-btn"><i class="fa-solid fa-plus"></i></div>
        `;
        colBar.onclick = (event) => {
            event.stopPropagation();
            event.preventDefault();
            window.addTableColumn(table);
        };
        table.appendChild(colBar);
    }

    // Create and position column handle above table.rows[0].cells[colIndex]
    const headerCell = table.rows[0].cells[colIndex];
    if (headerCell) {
        const colHandle = document.createElement('div');
        colHandle.className = 'table-col-handle';
        colHandle.contentEditable = 'false';
        colHandle.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
        colHandle.onmousedown = (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.selectTableColumn(table, colIndex);

            isDraggingCol = true;
            dragStartIndex = colIndex;
            activeDragTable = table;
            table.classList.add('table-dragging');
        };
        headerCell.appendChild(colHandle);
    }

    // Create and position row handle to the left of table.rows[rowIndex].cells[0]
    const firstCell = table.rows[rowIndex].cells[0];
    if (firstCell) {
        const rowHandle = document.createElement('div');
        rowHandle.className = 'table-row-handle';
        rowHandle.contentEditable = 'false';
        rowHandle.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
        rowHandle.onmousedown = (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.selectTableRow(table, rowIndex);

            isDraggingRow = true;
            dragStartIndex = rowIndex;
            activeDragTable = table;
            table.classList.add('table-dragging');
        };
        firstCell.appendChild(rowHandle);
    }
});

// Cursor shape listener for column resizing
document.addEventListener('mousemove', (e) => {
    if (isResizingColumn || isDraggingCol || isDraggingRow) return;

    const cell = e.target.closest('#docsEditor td, #docsEditor th');
    if (cell) {
        const rect = cell.getBoundingClientRect();
        // Check if mouse is close to the right edge and cell has a next column
        const isNearRightBorder = (e.clientX >= rect.right - 8 && e.clientX <= rect.right + 2);
        if (isNearRightBorder && cell.nextElementSibling) {
            cell.style.cursor = 'col-resize';
            cell.dataset.canResize = 'true';
        } else {
            cell.style.cursor = '';
            delete cell.dataset.canResize;
        }
    }
});

// Mousedown to initiate resizing
document.addEventListener('mousedown', (e) => {
    const cell = e.target.closest('#docsEditor td, #docsEditor th');
    if (cell && cell.dataset.canResize === 'true') {
        e.preventDefault();
        e.stopPropagation();

        isResizingColumn = true;
        
        const table = cell.closest('table');
        const colIndex = cell.cellIndex;
        const firstRow = table.rows[0];
        const cell1 = firstRow.cells[colIndex];
        const cell2 = firstRow.cells[colIndex + 1];
        
        const tableWidth = table.clientWidth;
        
        // Convert to percentage widths if not already set
        const firstRowCells = Array.from(firstRow.cells);
        const totalPX = firstRowCells.reduce((acc, c) => acc + c.getBoundingClientRect().width, 0);
        firstRowCells.forEach(c => {
            if (!c.style.width) {
                c.style.width = (c.getBoundingClientRect().width / totalPX * 100) + '%';
            }
        });

        const startPct1 = parseFloat(cell1.style.width);
        const startPct2 = parseFloat(cell2.style.width);
        const startX = e.clientX;

        const onMouseMoveResize = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dPct = (dx / tableWidth) * 100;
            
            let newPct1 = startPct1 + dPct;
            let newPct2 = startPct2 - dPct;
            
            // Constrain minimum percentage (5%)
            if (newPct1 < 5) {
                newPct2 += (newPct1 - 5);
                newPct1 = 5;
            }
            if (newPct2 < 5) {
                newPct1 += (newPct2 - 5);
                newPct2 = 5;
            }
            
            cell1.style.width = newPct1 + '%';
            cell2.style.width = newPct2 + '%';
        };

        const onMouseUpResize = () => {
            isResizingColumn = false;
            document.removeEventListener('mousemove', onMouseMoveResize);
            document.removeEventListener('mouseup', onMouseUpResize);
            const editor = document.getElementById('docsEditor');
            if (editor) editor.dispatchEvent(new Event('input'));
        };

        document.addEventListener('mousemove', onMouseMoveResize);
        document.addEventListener('mouseup', onMouseUpResize);
    }
});

// Drag to reorder columns or rows (mousemove)
document.addEventListener('mousemove', (e) => {
    if (isDraggingCol && activeDragTable) {
        const targetCell = e.target.closest('#docsEditor td, #docsEditor th');
        if (targetCell && targetCell.closest('table') === activeDragTable) {
            const targetCol = targetCell.cellIndex;
            if (targetCol !== undefined && targetCol !== dragStartIndex) {
                const rows = activeDragTable.rows;
                for (let r = 0; r < rows.length; r++) {
                    const row = rows[r];
                    const cellA = row.cells[dragStartIndex];
                    const cellB = row.cells[targetCol];
                    if (cellA && cellB) {
                        if (dragStartIndex < targetCol) {
                            row.insertBefore(cellA, cellB.nextSibling);
                        } else {
                            row.insertBefore(cellA, cellB);
                        }
                    }
                }
                dragStartIndex = targetCol;
                window.selectTableColumn(activeDragTable, dragStartIndex);
            }
        }
    } else if (isDraggingRow && activeDragTable) {
        const targetCell = e.target.closest('#docsEditor td, #docsEditor th');
        if (targetCell && targetCell.closest('table') === activeDragTable) {
            const targetRow = targetCell.parentElement.rowIndex;
            if (targetRow !== undefined && targetRow !== dragStartIndex && targetRow >= 0) {
                const rowA = activeDragTable.rows[dragStartIndex];
                const rowB = activeDragTable.rows[targetRow];
                if (rowA && rowB) {
                    const parent = rowA.parentNode;
                    if (dragStartIndex < targetRow) {
                        parent.insertBefore(rowA, rowB.nextSibling);
                    } else {
                        parent.insertBefore(rowA, rowB);
                    }
                }
                dragStartIndex = targetRow;
                window.selectTableRow(activeDragTable, dragStartIndex);
            }
        }
    }
});

// Drag stop
document.addEventListener('mouseup', () => {
    if (isDraggingCol || isDraggingRow) {
        isDraggingCol = false;
        isDraggingRow = false;
        if (activeDragTable) {
            activeDragTable.classList.remove('table-dragging');
            activeDragTable = null;
        }
        const editor = document.getElementById('docsEditor');
        if (editor) editor.dispatchEvent(new Event('input'));
    }
});

// Clear selection and controls on outside click
document.addEventListener('click', (e) => {
    const cell = e.target.closest('#docsEditor td, #docsEditor th');
    const handle = e.target.closest('.table-col-handle, .table-row-handle, .table-add-row-bar, .table-add-col-bar');
    if (!cell && !handle) {
        window.clearTableSelection();
        // Also clear active handles
        document.querySelectorAll('#docsEditor table').forEach(t => {
            t.querySelectorAll('.table-col-handle, .table-row-handle').forEach(h => h.remove());
        });
        activeHoveredCell = null;
    }
});

// Delete Key handler for selected column/row
document.addEventListener('keydown', (e) => {
    if (activeTableSelection && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        const { type, table, index } = activeTableSelection;
        if (type === 'column') {
            for (let r = 0; r < table.rows.length; r++) {
                if (table.rows[r].cells[index]) {
                    table.rows[r].deleteCell(index);
                }
            }
            const firstRow = table.rows[0];
            if (firstRow) {
                const firstRowCells = Array.from(firstRow.cells);
                const remaining = firstRowCells.length;
                if (remaining > 0) {
                    firstRowCells.forEach(c => {
                        c.style.width = (100 / remaining) + '%';
                    });
                } else {
                    table.remove();
                }
            } else {
                table.remove();
            }
        } else if (type === 'row') {
            table.deleteRow(index);
            if (table.rows.length === 0) {
                table.remove();
            }
        }
        window.clearTableSelection();
        const editor = document.getElementById('docsEditor');
        if (editor) editor.dispatchEvent(new Event('input'));
    }
});

// --- Image Resizing Manager ---
let activeResizingImg = null;
let activeImgResizer = null;

window.removeImageResizer = function() {
    if (activeImgResizer) {
        activeImgResizer.remove();
        activeImgResizer = null;
    }
    activeResizingImg = null;
};

document.addEventListener('click', (e) => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.closest('#docsEditor')) {
        e.stopPropagation();
        window.showImageResizer(img);
    } else {
        if (!e.target.closest('.img-resizer-overlay')) {
            window.removeImageResizer();
        }
    }
});

window.showImageResizer = function(img) {
    window.removeImageResizer();
    
    activeResizingImg = img;
    
    const editor = document.getElementById('docsEditor');
    if (!editor) return;

    const overlay = document.createElement('div');
    overlay.className = 'img-resizer-overlay';
    overlay.contentEditable = 'false';
    overlay.innerHTML = `
        <div class="img-resizer-handle tl" data-handle="tl"></div>
        <div class="img-resizer-handle tr" data-handle="tr"></div>
        <div class="img-resizer-handle bl" data-handle="bl"></div>
        <div class="img-resizer-handle br" data-handle="br"></div>
    `;
    
    editor.parentElement.appendChild(overlay);
    activeImgResizer = overlay;
    
    const updateOverlayPosition = () => {
        if (!activeResizingImg || !activeImgResizer) return;
        const rect = activeResizingImg.getBoundingClientRect();
        const parentRect = editor.parentElement.getBoundingClientRect();
        
        activeImgResizer.style.top = (rect.top - parentRect.top) + 'px';
        activeImgResizer.style.left = (rect.left - parentRect.left) + 'px';
        activeImgResizer.style.width = rect.width + 'px';
        activeImgResizer.style.height = rect.height + 'px';
    };
    
    updateOverlayPosition();
    
    const onScrollOrResize = () => {
        updateOverlayPosition();
    };
    editor.addEventListener('scroll', onScrollOrResize);
    window.addEventListener('resize', onScrollOrResize);
    
    overlay.querySelectorAll('.img-resizer-handle').forEach(handle => {
        handle.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const type = handle.getAttribute('data-handle');
            const startX = e.clientX;
            const startWidth = img.clientWidth;
            
            const onMouseMoveImg = (moveEvent) => {
                const dx = moveEvent.clientX - startX;
                let newWidth = startWidth;
                
                if (type === 'br' || type === 'tr') {
                    newWidth = startWidth + dx;
                } else if (type === 'bl' || type === 'tl') {
                    newWidth = startWidth - dx;
                }
                
                newWidth = Math.max(30, newWidth);
                img.style.width = newWidth + 'px';
                img.style.height = 'auto';
                
                updateOverlayPosition();
            };
            
            const onMouseUpImg = () => {
                document.removeEventListener('mousemove', onMouseMoveImg);
                document.removeEventListener('mouseup', onMouseUpImg);
                editor.dispatchEvent(new Event('input'));
            };
            
            document.addEventListener('mousemove', onMouseMoveImg);
            document.addEventListener('mouseup', onMouseUpImg);
        };
    });
};
