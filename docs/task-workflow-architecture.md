# Task Workflow Architecture

## API contract

```http
PATCH /tasks/:id/status
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "status": "IN_PROGRESS"
}
```

Only `OWNER` and `ADMIN` of the task's organization may transition status.
Allowed transitions are:

```text
TODO        -> IN_PROGRESS
IN_PROGRESS -> TODO | DONE
DONE        -> IN_PROGRESS
```

| Situation                              | Status | Error code                       |
| -------------------------------------- | -----: | -------------------------------- |
| Unknown status value                   |    400 | `INVALID_INPUT`                  |
| Invalid, repeated, or stale transition |    400 | `INVALID_TASK_STATUS_TRANSITION` |
| Task does not exist                    |    404 | `TASK_NOT_FOUND`                 |
| Actor cannot manage the project        |    403 | authorization error              |

## Status transition flow

```mermaid
sequenceDiagram
    participant Client
    participant Router as Express router/authenticate
    participant Controller
    participant Service
    participant Tasks as Tasks repository
    participant DB as PostgreSQL

    Client->>Router: PATCH /tasks/:id/status
    Router->>Controller: authenticated request
    Controller->>Controller: Zod validates UUID and status enum
    Controller->>Service: updateTaskStatus(actorId, taskId, status)
    Service->>Tasks: find task and project
    Service->>Service: require project-manager role
    Service->>Service: validate current -> next transition
    alt transition is invalid
        Service-->>Client: 400 INVALID_TASK_STATUS_TRANSITION
    else transition is valid
        Service->>Tasks: UPDATE WHERE id AND status = expectedStatus
        Tasks->>DB: conditional mutation
        alt another request changed status first
            DB-->>Service: no updated row
            Service-->>Client: 400 INVALID_TASK_STATUS_TRANSITION
        else expected status still current
            DB-->>Client: 200 { task }
        end
    end
```

## Concurrency decision

The service reads the current status to select an allowed transition. The
repository then includes that current status in the SQL `WHERE` clause. Two
concurrent `TODO -> IN_PROGRESS` requests therefore cannot both succeed: the
first changes the row and the second no longer matches `status = TODO`.

This is optimistic concurrency control without a version column. A `version`
column becomes useful if later operations need clients to detect arbitrary
concurrent edits across multiple fields; status transitions already have a
natural expected-state value.

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
