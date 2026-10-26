# App 2 — API REST de tareas (Node.js + Express + PostgreSQL)

Parcial 2 · Informática en la Nube. Desplegada en **Render** con base de datos **PostgreSQL administrada**.

## Variables de entorno (se configuran en el panel de Render, nunca en el código)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión de PostgreSQL (Internal Database URL de Render) |
| `PORT` | Lo define Render automáticamente |

La tabla `tareas` se crea automáticamente en el primer arranque.

## Endpoints
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/tareas` | Lista las tareas |
| GET | `/api/tareas/:id` | Detalle de una tarea |
| POST | `/api/tareas` | Crea una tarea (`titulo`, `descripcion`, `estado`) |
| PUT | `/api/tareas/:id` | Actualiza una tarea |
| DELETE | `/api/tareas/:id` | Elimina una tarea |
| GET | `/health` | Estado de la app y de la BD |

## Comandos en Render
- Build: `npm install`
- Start: `npm start`
