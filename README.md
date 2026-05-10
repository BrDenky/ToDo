# ToDo List - Prueba Técnica 1

![Django](https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=green)
![Django REST Framework](https://img.shields.io/badge/DRF-a30000?style=for-the-badge&logo=django&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

## 📖 Descripción
Este proyecto es una aplicación web full-stack de gestión de tareas (ToDo List). Cuenta con un backend robusto basado en **Django REST Framework** que expone una API para operaciones CRUD completas, y un cliente frontend moderno con diseño *Glassmorphism* y animaciones dinámicas construido con HTML, CSS y Vanilla JavaScript.

## ✨ Características Principales
* **API RESTful Completa**: Endpoints estructurados y escalables para el manejo asíncrono de los datos (GET, POST, PUT, DELETE).
* **Interfaz de Usuario Premium**: Diseño *Glassmorphism*, paletas de colores inmersivas en modo oscuro, y transiciones fluidas.
* **Gestor de Tareas Avanzado**:
  * Creación rápida de tareas con Título, Fecha y Descripción.
  * Marcado inteligente de tareas como Completadas o Pendientes.
  * Reordenamiento automático (las completadas pasan al final de la lista).
  * Confirmación visual antes de eliminar registros.
* **Base de datos local**: Integración instantánea sin necesidad de configuraciones de servidor de base de datos gracias a SQLite.

## 🛠️ Tecnologías Utilizadas
* **Backend:** Python 3.x, Django, Django REST Framework (DRF)
* **Frontend:** HTML5, CSS3 (Animaciones, Variables CSS), JS (Fetch API)
* **Base de Datos:** SQLite3

## 🚀 Instalación y Configuración

1. **Clonar el repositorio:**
   Descarga el proyecto en tu máquina local a través de Git.

2. **Crear y activar un entorno virtual:**
   Para no interferir con las dependencias globales de tu sistema.
   ```bash
   # En Windows
   python -m venv env
   .\env\Scripts\activate
   ```

3. **Instalar las dependencias:**
   Ejecuta el siguiente comando para instalar Django y DRF.
   ```bash
   pip install -r requirements.txt
   ```

4. **Ejecutar migraciones de la base de datos:**
   ```bash
   cd ToDo
   python manage.py migrate
   ```

5. **Levantar el servidor local:**
   ```bash
   python manage.py runserver
   ```
   *Accede a [http://127.0.0.1:8000/](http://127.0.0.1:8000/) en tu navegador.*

## 📁 Estructura del Proyecto

```text
Prueba1/
├── requirements.txt            # Dependencias del proyecto
└── ToDo/                       # Directorio del proyecto Django
    ├── manage.py               # Orquestador del proyecto
    ├── db.sqlite3              # Base de datos SQLite
    ├── ToDo/                   # Configuración global del proyecto
    │   ├── settings.py         # Archivo principal de ajustes
    │   └── urls.py             # Enrutador principal (Incluye vista del index)
    └── Main/                   # Aplicación Principal
        ├── models.py           # Esquema de la tabla To_do
        ├── serializers.py      # Serializador para la API (Modelo -> JSON)
        ├── views.py            # Vistas CRUD con DRF (Create, Read, Update, Delete)
        ├── urls.py             # Rutas exclusivas de la API REST (/api/)
        └── templates/          
            └── index.html      # Interfaz de Usuario (Frontend HTML, CSS y JS)
```

## 🤝 Contribuciones
Este es un proyecto de prueba técnica. Siéntete libre de clonarlo, estudiarlo y aplicar tus propias mejoras, como implementar autenticación de usuarios o mejorar la escalabilidad de los modelos.
