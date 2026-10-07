# Task Management Architecture

## API contract

| Method   | Endpoint                     | Permission                                       |
| -------- | ---------------------------- | ------------------------------------------------ |
| `POST`   | `/projects/:projectId/tasks` | `OWNER` or `ADMIN` of the project's organization |
| `GET`    | `/projects/:projectId/tasks` | Any organization member                          |
| `GET`    | `/tasks/:id`                 | Any organization member                          |
| `PATCH`  | `/tasks/:id`                 | `OWNER` or `ADMIN`                               |
| `DELETE` | `/tasks/:id`                 | `OWNER` or `ADMIN`                               |

`POST` creates a task with `status = TODO`, `priority = MEDIUM`, and no
assignee unless a supported creation field provides a priority or due date.
Assignment is intentionally deferred to Phase 8 and status transitions to
Phase 9, so neither `assigneeId` nor `status` is accepted by the CRUD API.

## Persistence and integrity

`tasks.project_id` is a foreign key to `projects.id` with `ON DELETE CASCADE`.
Deleting a project therefore cannot leave orphan tasks. `creator_id` is a
required user reference, while `assignee_id` is nullable for the later
assignment feature. The `(project_id, created_at)` index supports the task-list
query and its stable newest-first ordering.

## Create task flow

```mermaid
sequenceDiagram
    participant Client
    participant Router as Express router/authenticate
    participant Controller
    participant Service
    participant Projects as Projects repository
    participant Membership as Organization authorization
    participant Tasks as Tasks repository
    participant DB as PostgreSQL

    Client->>Router: POST /projects/:projectId/tasks
    Router->>Controller: authenticated request
    Controller->>Controller: Zod validate params and body
    Controller->>Service: createTask(actorId, projectId, input)
    Service->>Projects: findById(projectId)
    alt project missing
        Service-->>Client: 404 PROJECT_NOT_FOUND
    else project exists
        Service->>Membership: requireProjectManager(actorId, organizationId)
        alt actor is OWNER or ADMIN
            Service->>Tasks: INSERT task with creatorId and defaults
            Tasks->>DB: INSERT ... RETURNING
            DB-->>Client: 201 { task }
        else actor is MEMBER or outsider
            Service-->>Client: 403 authorization error
        end
    end
```

## Update and delete flows

```mermaid
sequenceDiagram
    participant Client
    participant Router as Express router/authenticate
    participant Controller
    participant Service
    participant Tasks as Tasks repository
    participant Projects as Projects repository
    participant DB as PostgreSQL

    Client->>Router: PATCH or DELETE /tasks/:id
    Router->>Controller: authenticated request
    Controller->>Controller: Zod validate ID and PATCH body
    Controller->>Service: updateTask/deleteTask(actorId, taskId)
    Service->>Tasks: findById(taskId)
    alt task missing
        Service-->>Client: 404 TASK_NOT_FOUND
    else task exists
        Service->>Projects: findById(task.projectId)
        Service->>Service: require project-manager role
        alt authorized
            Service->>Tasks: UPDATE or DELETE ... RETURNING
            Tasks->>DB: mutate task row
            DB-->>Client: 200 { task } or 204
        else unauthorized
            Service-->>Client: 403 authorization error
        end
    end
```

## Module responsibilities

```text
src/modules/tasks/
  tasks.route.ts        Endpoint composition and authentication.
  tasks.controller.ts   HTTP input/output and Zod parsing.
  tasks.service.ts      Task rules and project/organization authorization.
  tasks.repository.ts   Task SQL through Drizzle.
  tasks.schema.ts       Request DTOs and route/query schemas.
```

## Verification

```bash
docker compose up -d
npm run db:migrate
npm run db:migrate:test
npm run format:check
npm run typecheck
npm run build
npm test
git diff --check
```
