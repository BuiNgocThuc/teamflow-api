# TeamFlow API — Implementation Plan

## 1. Project Goal

TeamFlow API là backend cho hệ thống quản lý team, project và task, tương tự một phiên bản đơn giản của Jira/Trello.

Mục tiêu chính của project:

- Củng cố nền tảng Node.js Backend.
- Sử dụng TypeScript trong một backend application thực tế.
- Hiểu rõ HTTP request lifecycle trong Node.js và Express.js.
- Xây dựng backend theo từng feature end-to-end.
- Hiểu authentication, authorization, database transaction, concurrency, caching, events, streams và testing.
- Tránh phụ thuộc quá nhiều vào abstraction của framework.
- Tạo một project đủ chất lượng để đưa vào CV.

Project này KHÔNG nhằm mục đích học microservices.

Kiến trúc chính là một Express.js application với PostgreSQL và Redis.

---

# 2. Core Technology Stack

## Runtime & Language

- Node.js
- TypeScript

## HTTP Framework

- Express.js

## Database

- PostgreSQL

## Data Access

ORM/query builder sẽ được lựa chọn khi bắt đầu database layer.

Ưu tiên:

- Prisma hoặc
- Drizzle

Không để ORM thay thế kiến thức SQL.

## Validation

- Zod

## Authentication

- JWT
- Access Token
- Refresh Token

## Logging

- Pino

## Cache

- Redis

## Testing

- Vitest
- Supertest

## Infrastructure

- Docker
- Docker Compose

## Documentation

- OpenAPI / Swagger

## CI

- GitHub Actions

---

# 3. Development Principle

Project được phát triển theo Vertical Slice.

Mỗi phase phải hoàn thành một feature end-to-end.

Flow tổng quát:

```text
HTTP Request
    ↓
Router
    ↓
Middleware
    ↓
Validation
    ↓
Controller
    ↓
Service
    ↓
Repository
    ↓
PostgreSQL
    ↓
Response
```

Một phase chỉ được coi là hoàn thành khi feature:

- chạy được end-to-end;
- có validation;
- có error handling;
- persist data đúng nếu feature sử dụng database;
- xử lý authentication/authorization nếu cần;
- có test cho các behavior quan trọng;
- không phá vỡ các feature đã hoàn thành trước đó.

Không implement trước infrastructure hoặc abstraction chỉ vì phase sau có thể cần.

---

# Phase 0 — Application Foundation

## Goal

Tạo foundation tối thiểu để application có thể chạy ổn định.

## Feature

Health Check.

```http
GET /health
```

Response:

```json
{
    "status": "ok"
}
```

## Implement

- Node.js project
- TypeScript
- Express
- environment configuration
- `app.ts`
- `server.ts`
- basic routing
- basic error handling
- basic logging

Phải hiểu rõ lý do tách:

```text
app.ts

Express application configuration
```

và:

```text
server.ts

process entry point
HTTP server startup
```

## Concepts

Trong phase này phải hiểu:

- Node.js process
- Node.js runtime
- V8
- Node.js HTTP server
- Express hoạt động trên Node HTTP như thế nào
- Event Loop ở mức cơ bản
- blocking vs non-blocking
- environment variables
- application startup

## End-to-End Flow

```text
Client
  ↓
GET /health
  ↓
Node HTTP Server
  ↓
Express
  ↓
Router
  ↓
Controller/Handler
  ↓
200 OK
```

## Definition of Done

```http
GET /health
```

trả:

```json
{
    "status": "ok"
}
```

Application có thể start và shutdown bình thường.

---

# Phase 1 — User Registration

## Goal

Xây dựng business feature đầu tiên hoàn chỉnh.

## API

```http
POST /auth/register
```

Request:

```json
{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password"
}
```

## Flow

```text
Request
  ↓
Zod Validation
  ↓
Auth Controller
  ↓
Auth Service
  ↓
Check Email
  ↓
Hash Password
  ↓
User Repository
  ↓
PostgreSQL
  ↓
201 Created
```

## Database

Create:

```text
users
```

Fields:

```text
id
name
email
password_hash
created_at
updated_at
```

Constraints:

```text
email UNIQUE
email NOT NULL
password_hash NOT NULL
```

## Business Rules

- Email phải hợp lệ.
- Email không được duplicate.
- Password phải đáp ứng minimum requirements.
- Password không bao giờ được lưu plaintext.
- Password hash không được trả về API.

## Error Cases

Implement ít nhất:

```text
400 INVALID_INPUT
409 EMAIL_ALREADY_EXISTS
500 INTERNAL_SERVER_ERROR
```

## Concepts

- request body
- validation boundary
- password hashing
- async I/O
- database connection
- connection pool
- repository pattern ở mức đơn giản
- database constraints
- HTTP status codes

## Tests

Test ít nhất:

- register successfully
- invalid email
- invalid password
- duplicate email
- password không xuất hiện trong response

## Definition of Done

User có thể register và record được lưu đúng trong PostgreSQL.

---

# Phase 2 — Login & Authentication

## Goal

User có thể authenticate và sử dụng protected API.

## APIs

```http
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

## Login Flow

```text
Email + Password
       ↓
Validation
       ↓
Find User
       ↓
Verify Password
       ↓
Generate Access Token
       ↓
Generate Refresh Token
       ↓
Response
```

## Implement

- JWT Access Token
- Refresh Token
- authentication middleware
- token verification
- token expiration
- logout behavior

## Protected Test Endpoint

Có thể tạm sử dụng:

```http
GET /users/me
```

để verify authentication.

## Concepts

Phải hiểu:

- authentication
- JWT structure
- signing vs encryption
- access token
- refresh token
- expiration
- authentication middleware
- request context
- `401 Unauthorized`

## Tests

- login success
- wrong email
- wrong password
- access protected endpoint
- invalid token
- expired token
- refresh token
- logout

## Definition of Done

Flow sau phải chạy end-to-end:

```text
Register
   ↓
Login
   ↓
Access Token
   ↓
Protected API
   ↓
Refresh
   ↓
New Access Token
   ↓
Logout
```

---

# Phase 3 — User Profile

## Goal

Authenticated user có thể đọc và cập nhật profile của chính mình.

## APIs

```http
GET /users/me
PATCH /users/me
```

## Flow

```text
Request
   ↓
Authentication Middleware
   ↓
Authenticated User
   ↓
Validation
   ↓
User Controller
   ↓
User Service
   ↓
User Repository
   ↓
PostgreSQL
```

## Business Rules

User chỉ được update profile của chính mình.

Không được update trực tiếp:

```text
id
password_hash
created_at
```

## Concepts

- authenticated request
- current-user context
- partial update
- DTO/schema validation
- sensitive fields

## Tests

- get current user
- update profile
- unauthenticated request
- invalid update

## Definition of Done

Authenticated user quản lý được profile của mình.

---

# Phase 4 — Organization Management

## Goal

User có thể tạo và quản lý organization.

## APIs

```http
POST /organizations

GET /organizations

GET /organizations/:id

PATCH /organizations/:id

DELETE /organizations/:id
```

## Database

Create:

```text
organizations

organization_members
```

Relation:

```text
User
  ↓
OrganizationMember
  ↓
Organization
```

## Roles

```text
OWNER
ADMIN
MEMBER
```

## Create Organization Flow

```text
Authenticated User
       ↓
Create Organization
       ↓
Create Organization Member
       ↓
role = OWNER
       ↓
Transaction Commit
```

## Important

Organization và OWNER membership phải được tạo trong cùng transaction.

Nếu tạo membership thất bại:

```text
ROLLBACK organization
```

## Concepts

- database relationships
- many-to-many relationship
- transaction
- atomic operation
- ownership
- authorization

## Tests

- create organization
- creator becomes OWNER
- list user's organizations
- get organization
- update organization
- unauthorized update
- delete organization

## Definition of Done

User tạo organization và tự động trở thành OWNER.

---

# Phase 5 — Organization Members & RBAC

## Goal

Organization có thể quản lý members.

## APIs

```http
POST /organizations/:id/members

GET /organizations/:id/members

PATCH /organizations/:id/members/:userId

DELETE /organizations/:id/members/:userId
```

## Authorization Rules

### OWNER

Có thể:

- add member
- remove member
- promote MEMBER → ADMIN
- demote ADMIN → MEMBER

### ADMIN

Có thể:

- add MEMBER
- remove MEMBER

Không được quản lý OWNER.

### MEMBER

Không được quản lý members.

## Flow

```text
Request
   ↓
Authentication
   ↓
Organization Membership
   ↓
Role Check
   ↓
Business Rules
   ↓
Database
```

## Concepts

- authentication vs authorization
- RBAC
- resource-based authorization
- `401` vs `403`
- authorization middleware/service

## Tests

Test role matrix quan trọng.

Ví dụ:

```text
OWNER → remove MEMBER → success

ADMIN → remove MEMBER → success

MEMBER → remove MEMBER → 403

ADMIN → remove OWNER → 403
```

## Definition of Done

Organization có RBAC hoạt động đúng.

---

# Phase 6 — Project Management

## Goal

Organization members có thể quản lý projects.

## APIs

```http
POST /organizations/:organizationId/projects

GET /organizations/:organizationId/projects

GET /projects/:id

PATCH /projects/:id

DELETE /projects/:id
```

## Database

```text
projects
```

Relation:

```text
Organization
     ↓
   Projects
```

## Business Rules

- Project luôn thuộc một organization.
- User phải thuộc organization mới được xem project.
- Chỉ role phù hợp mới được create/update/delete project.

## Concepts

- nested resources
- authorization theo parent resource
- foreign keys
- database indexes

## Tests

- create project
- list organization projects
- get project
- unauthorized access
- update project
- delete project

## Definition of Done

Organization có thể quản lý nhiều projects với authorization đúng.

---

# Phase 7 — Task Management

## Goal

Implement core business feature của TeamFlow.

## APIs

```http
POST /projects/:projectId/tasks

GET /projects/:projectId/tasks

GET /tasks/:id

PATCH /tasks/:id

DELETE /tasks/:id
```

## Database

```text
tasks
```

Fields:

```text
id
project_id
creator_id
assignee_id
title
description
status
priority
due_date
created_at
updated_at
```

## Status

```text
TODO
IN_PROGRESS
DONE
```

## Priority

```text
LOW
MEDIUM
HIGH
```

## Business Rules

- Task phải thuộc project.
- Creator phải có quyền truy cập project.
- Assignee phải thuộc cùng organization.
- Invalid status/priority phải bị reject.

## Concepts

- relational modeling
- foreign keys
- domain validation
- business validation
- query design

## Tests

- create task
- get task
- update task
- delete task
- invalid project
- unauthorized project access

## Definition of Done

Project có thể quản lý tasks end-to-end.

---

# Phase 8 — Task Assignment

## Goal

Tách assignment thành business operation rõ ràng.

## API

```http
PATCH /tasks/:id/assignee
```

Request:

```json
{
    "assigneeId": "user-id"
}
```

## Flow

```text
Task
 ↓
Project
 ↓
Organization
 ↓
Find Organization Membership
 ↓
Is Assignee Member?
   ↓
YES → Assign
NO  → Reject
```

## Business Rules

Không được assign task cho user không thuộc organization.

## Concepts

- cross-entity validation
- domain invariants
- transaction boundary
- race conditions cơ bản

## Tests

- assign valid member
- assign non-member
- unauthorized assignment
- reassign task

## Definition of Done

Task assignment bảo toàn organization membership invariant.

---

# Phase 9 — Task Workflow

## Goal

Task status trở thành business workflow thay vì field CRUD thông thường.

## API

```http
PATCH /tasks/:id/status
```

Request:

```json
{
    "status": "IN_PROGRESS"
}
```

## Initial Workflow

```text
TODO
 ↓
IN_PROGRESS
 ↓
DONE
```

Allowed transitions:

```text
TODO → IN_PROGRESS

IN_PROGRESS → TODO

IN_PROGRESS → DONE

DONE → IN_PROGRESS
```

Không cho arbitrary status update ngoài workflow.

## Concepts

- state transitions
- domain rules
- concurrency
- lost updates
- optimistic locking

Có thể thêm:

```text
version
```

cho Task nếu cần optimistic concurrency control.

## Tests

- valid transitions
- invalid transitions
- concurrent update scenario

## Definition of Done

Task status được kiểm soát bởi business workflow.

---

# Phase 10 — Task Comments

## Goal

Organization members có thể thảo luận trên task.

## APIs

```http
POST /tasks/:id/comments

GET /tasks/:id/comments

PATCH /comments/:id

DELETE /comments/:id
```

## Database

```text
comments
```

Relation:

```text
Task
 │
 ├── Comment
 ├── Comment
 └── Comment
```

## Business Rules

- User phải có quyền truy cập task.
- Comment author có thể edit comment.
- Comment author có thể delete comment.
- Organization permissions có thể override nếu cần.

## Concepts

- ownership authorization
- parent resource authorization
- pagination

## Tests

- create comment
- list comments
- edit own comment
- edit another user's comment
- delete comment

## Definition of Done

Task có discussion thread cơ bản.

---

# Phase 11 — Activity Log

## Goal

Theo dõi các thay đổi quan trọng trong project.

## API

```http
GET /projects/:id/activities
```

## Track Events

Ít nhất:

```text
TASK_CREATED

TASK_ASSIGNED

TASK_STATUS_CHANGED

TASK_PRIORITY_CHANGED

COMMENT_CREATED
```

## Example

```text
Actor: John

Action:
TASK_STATUS_CHANGED

Task:
Implement Authentication

From:
TODO

To:
IN_PROGRESS
```

## Implementation

Bắt đầu sử dụng Node.js EventEmitter.

```text
Task Service
     ↓
emit task.status.changed
     ↓
Activity Listener
     ↓
Activity Repository
     ↓
PostgreSQL
```

## Concepts

- EventEmitter
- event-driven programming
- synchronous vs asynchronous event handling
- side effects
- eventual consistency ở mức conceptual

## Important

Không sử dụng RabbitMQ.

Events vẫn nằm trong cùng Node.js process.

## Tests

- task update generates activity
- assignment generates activity
- activity ordering
- authorization

## Definition of Done

Project có audit/activity history cho các action quan trọng.

---

# Phase 12 — Task Querying

## Goal

Biến task listing thành API thực tế thay vì CRUD listing đơn giản.

## API

```http
GET /projects/:id/tasks
```

Support:

```text
status

priority

assigneeId

search

sort

order

page

limit
```

Example:

```http
GET /projects/123/tasks?status=IN_PROGRESS&priority=HIGH&assigneeId=456&search=authentication&sort=dueDate&order=asc&page=1&limit=20
```

## Concepts

- filtering
- sorting
- pagination
- query validation
- SQL WHERE
- ORDER BY
- LIMIT/OFFSET
- indexes
- query performance
- N+1 problem

## Tests

- filtering
- multiple filters
- sorting
- pagination
- search
- invalid query parameters

## Definition of Done

Task API support production-style querying.

---

# Phase 13 — Notifications

## Goal

User nhận notification cho các action liên quan.

## APIs

```http
GET /notifications

PATCH /notifications/:id/read
```

## Events

Ví dụ:

```text
TASK_ASSIGNED
COMMENT_ADDED
```

Flow:

```text
Task Assigned
      ↓
EventEmitter
      ↓
Notification Listener
      ↓
Notification Service
      ↓
PostgreSQL
```

## Example Notification

```text
Alice assigned you to:

"Implement Authentication"
```

## Concepts

- event consumers
- decoupled side effects
- notification persistence
- unread/read state

## Tests

- assignment generates notification
- notification belongs to correct user
- mark notification as read
- unauthorized notification access

## Definition of Done

User có persistent in-app notifications.

---

# Phase 14 — Redis Caching

## Goal

Introduce Redis khi application đã có use case thực tế.

## Feature

Project Summary.

## API

```http
GET /projects/:id/summary
```

Summary có thể bao gồm:

```json
{
    "totalTasks": 30,
    "todo": 10,
    "inProgress": 12,
    "done": 8
}
```

## Cache Flow

```text
Request
   ↓
Redis

HIT
 ↓
Return

MISS
 ↓
PostgreSQL
 ↓
Calculate Summary
 ↓
Redis SET
 ↓
Return
```

## Invalidation

Task thay đổi:

```text
Task Created
Task Deleted
Task Status Changed
        ↓
Invalidate Project Summary Cache
```

## Concepts

- cache-aside pattern
- cache hit
- cache miss
- TTL
- cache invalidation
- stale data
- serialization
- Redis connection lifecycle

## Tests

- cache miss
- cache hit
- invalidation
- Redis unavailable behavior

## Definition of Done

Project Summary sử dụng cache đúng và vẫn hoạt động khi cache miss.

---

# Phase 15 — Rate Limiting

## Goal

Bảo vệ sensitive APIs.

## Apply To

Ít nhất:

```http
POST /auth/login
POST /auth/register
```

## Redis

Sử dụng Redis để lưu request counters nếu phù hợp.

## Concepts

- rate limiting
- brute-force protection
- distributed counters
- TTL
- client identification

## Tests

- requests dưới limit
- requests vượt limit
- reset sau TTL

## Definition of Done

Sensitive endpoints được bảo vệ khỏi excessive requests.

---

# Phase 16 — CSV Task Export

## Goal

Học Node.js Streams thông qua feature thực tế.

## API

```http
GET /projects/:id/tasks/export
```

Response:

```text
Content-Type: text/csv
```

## Important

KHÔNG:

```text
Load all tasks
      ↓
Store everything in memory
      ↓
Generate huge CSV
```

Ưu tiên:

```text
PostgreSQL
    ↓
Readable Stream / batched source
    ↓
Transform
    ↓
HTTP Response
```

## Concepts

- Readable Stream
- Writable Stream
- Transform Stream
- pipe
- pipeline
- backpressure
- memory efficiency
- client disconnect
- stream errors

## Tests

- valid export
- authorization
- large dataset behavior
- stream error handling

## Definition of Done

Task data được export mà không cần load toàn bộ dataset vào application memory.

---

# Phase 17 — Production Hardening

## Goal

Đưa application tới trạng thái portfolio/production-style.

## Structured Logging

Use:

```text
Pino
```

Log:

```text
requestId
method
url
status
duration
error
```

Không log:

```text
password
access token
refresh token
secrets
```

---

## Request ID

Mỗi request có unique request ID.

Flow:

```text
Request
 ↓
Request ID Middleware
 ↓
Controller
 ↓
Service
 ↓
Repository
 ↓
Logs
```

---

## Security

Review:

- Helmet
- CORS
- rate limiting
- secure headers
- input validation
- secrets
- JWT security
- password hashing
- SQL injection
- sensitive error messages

---

## Graceful Shutdown

Handle:

```text
SIGTERM
SIGINT
```

Flow:

```text
Signal
  ↓
Stop accepting new requests
  ↓
Finish active requests
  ↓
Close HTTP Server
  ↓
Close PostgreSQL
  ↓
Close Redis
  ↓
Exit
```

Phải hiểu tại sao không nên:

```ts
process.exit(0);
```

ngay lập tức.

---

## Docker

Dockerize:

```text
teamflow-api
PostgreSQL
Redis
```

Docker Compose phải có thể start development environment.

---

## API Documentation

Generate OpenAPI/Swagger documentation cho các public APIs.

---

## CI

GitHub Actions pipeline:

```text
Push / Pull Request
       ↓
Install
       ↓
Lint
       ↓
Type Check
       ↓
Tests
       ↓
Build
```

## Definition of Done

Một developer mới có thể:

```text
clone repository

↓

configure .env

↓

docker compose up

↓

install dependencies

↓

run migrations

↓

start application

↓

run tests
```

dựa vào README.

---

# 4. Final End-to-End User Journey

Khi project hoàn thành, flow sau phải hoạt động:

```text
Register User
      ↓
Login
      ↓
Create Organization
      ↓
Add Members
      ↓
Create Project
      ↓
Create Task
      ↓
Assign Task
      ↓
TODO
      ↓
IN_PROGRESS
      ↓
DONE
      ↓
Add Comments
      ↓
Activity Generated
      ↓
Notification Generated
      ↓
Query / Filter Tasks
      ↓
View Project Summary
      ↓
Export Tasks
```

---

# 5. Milestones

## Milestone 1 — Basic Backend

Complete:

```text
Phase 0
Phase 1
Phase 2
Phase 3
```

Result:

```text
Node.js
Express
PostgreSQL
Authentication
```

---

## Milestone 2 — TeamFlow MVP

Complete:

```text
Phase 4
Phase 5
Phase 6
Phase 7
Phase 8
Phase 9
```

Result:

```text
Organization
Members
RBAC
Projects
Tasks
Assignment
Workflow
```

At this point the application has a complete core business flow.

---

## Milestone 3 — Real Product Features

Complete:

```text
Phase 10
Phase 11
Phase 12
Phase 13
```

Result:

```text
Comments
Activity
Filtering
Notifications
```

---

## Milestone 4 — Node.js Deep Dive

Complete:

```text
Phase 14
Phase 15
Phase 16
```

Result:

```text
Redis
Caching
Rate Limiting
Streams
Backpressure
```

---

## Milestone 5 — CV Ready

Complete:

```text
Phase 17
```

Result:

```text
Testing
Logging
Security
Graceful Shutdown
Docker
Swagger
CI
Documentation
```

---

# 6. Out of Scope

Không thêm các công nghệ sau trừ khi plan được thay đổi có chủ đích:

```text
Microservices
Kafka
RabbitMQ
Kubernetes
GraphQL
Elasticsearch
CQRS
Saga
NestJS
```

Lý do:

Project này tập trung vào:

```text
Node.js
TypeScript
Express.js
PostgreSQL
Redis
Backend Engineering Fundamentals
```

Không biến TeamFlow thành distributed system.

---

# 7. Rules for Codex

Trước khi bắt đầu bất kỳ phase nào:

1. Đọc `AGENTS.md`.
2. Đọc `plan.md`.
3. Xác định phase hiện tại.
4. Kiểm tra code hiện tại trước khi đề xuất thay đổi.
5. Không implement feature thuộc phase tương lai.

Khi bắt đầu một phase:

1. Giải thích business requirement.
2. Giải thích kiến thức Node.js/backend liên quan.
3. Xác định API contract.
4. Xác định data model thay đổi nếu có.
5. Vẽ request/data flow bằng text.
6. Chia feature thành các task nhỏ.
7. Hướng dẫn tôi implement từng task.

Không generate toàn bộ phase ngay lập tức trừ khi tôi yêu cầu rõ ràng.

Sau khi tôi implement:

1. Review code.
2. Kiểm tra correctness.
3. Kiểm tra TypeScript.
4. Kiểm tra error handling.
5. Kiểm tra security.
6. Kiểm tra database behavior.
7. Kiểm tra test coverage của behavior quan trọng.
8. Giải thích vấn đề trước khi sửa.

Chỉ đánh dấu phase hoàn thành khi Definition of Done của phase đó đã đạt.

Sau khi hoàn thành phase:

1. Tóm tắt feature đã hoàn thành.
2. Tóm tắt kiến thức Node.js/backend đã học.
3. Chỉ ra technical debt nếu có.
4. Đề xuất commit message.
5. Xác nhận phase tiếp theo trong `plan.md`.

---

# 8. Current Phase

```text
Phase 0 — Application Foundation
```

Không bắt đầu Phase 1 cho đến khi Phase 0 hoàn thành.
