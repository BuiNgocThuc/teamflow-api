# TeamFlow API

TeamFlow API là backend cho ứng dụng quản lý công việc nhóm, lấy cảm hứng từ Jira và Trello. Dự án học Node.js/TypeScript theo từng vertical slice: Express xử lý HTTP, PostgreSQL lưu dữ liệu, và mỗi feature đi từ validation đến integration test.

## Chức năng đã triển khai

| Chức năng      | Mô tả                                                                      |
| -------------- | -------------------------------------------------------------------------- |
| Registration   | Tạo tài khoản với password Argon2id; chỉ trả public user fields.           |
| Authentication | Login, JWT access token, refresh-token rotation và logout.                 |
| User profile   | Xem/cập nhật tên và email của người dùng hiện tại.                         |
| Organizations  | Tạo, liệt kê có phân trang, xem, đổi tên và xóa workspace.                 |
| Members & RBAC | Quản lý `OWNER`, `ADMIN`, `MEMBER` theo organization.                      |
| Projects       | CRUD project trong organization.                                           |
| Tasks          | CRUD task, priority, due date, assignment và workflow status có kiểm soát. |

Chưa có comments, activity logs, notifications, invitation/user lookup, leave organization, ownership transfer, task unassignment, search/filter/sort, Kanban board, global task list, Redis caching, CSV export hoặc real-time updates. Client không nên biểu diễn chúng như capability đang hoạt động.

## Công nghệ

- Node.js, TypeScript, Express 5
- PostgreSQL, Drizzle ORM
- Zod, Argon2id, `jose`
- Vitest, Supertest, Docker Compose

## Authentication và browser security

`POST /auth/login` trả:

```json
{ "accessToken": "jwt" }
```

Access token là JWT sống ngắn, được frontend giữ trong memory và gửi qua `Authorization: Bearer <access-token>`.

Refresh token không xuất hiện trong JSON. API gửi nó qua cookie `teamflow_refresh_token` với `HttpOnly`, `SameSite=Lax`, `Path=/auth`; cookie được đặt `Secure` khi `NODE_ENV=production`. Browser tự gửi cookie này cho `POST /auth/refresh` (rotate token và trả access token mới) và `POST /auth/logout` (revoke token nếu có, xóa cookie, trả `204`).

API cho phép credentialed CORS chỉ từ `FRONTEND_ORIGIN`; không sử dụng wildcard origin. Nếu frontend và API thực sự cross-site, cần chuyển cookie sang `SameSite=None; Secure` **và** bổ sung CSRF/origin protection trước khi deploy.

## API overview

### Public endpoints

| Method | Endpoint         | Response                                       |
| ------ | ---------------- | ---------------------------------------------- |
| `GET`  | `/health`        | `{ "status": "ok" }`                           |
| `POST` | `/auth/register` | `201 { user }`                                 |
| `POST` | `/auth/login`    | `200 { accessToken }` + refresh cookie         |
| `POST` | `/auth/refresh`  | `200 { accessToken }` + rotated refresh cookie |
| `POST` | `/auth/logout`   | `204` + clears refresh cookie                  |

Mọi endpoint dưới đây yêu cầu bearer access token.

| Resource      | Endpoints                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Current user  | `GET`, `PATCH /users/me`                                                                                                              |
| Organizations | `POST`, `GET /organizations`; `GET`, `PATCH`, `DELETE /organizations/:id`                                                             |
| Members       | `GET`, `POST /organizations/:id/members`; `PATCH`, `DELETE /organizations/:id/members/:userId`                                        |
| Projects      | `POST`, `GET /organizations/:organizationId/projects`; `GET`, `PATCH`, `DELETE /projects/:id`                                         |
| Tasks         | `POST`, `GET /projects/:projectId/tasks`; `GET`, `PATCH`, `DELETE /tasks/:id`; `PATCH /tasks/:id/assignee`; `PATCH /tasks/:id/status` |

Organization, project và task lists chỉ hỗ trợ `?page=1&limit=20`; response có dạng `{ data, pagination }` và `limit` nằm trong khoảng 1–100.

## Roles và task workflow

| Action                                      | OWNER | ADMIN | MEMBER |
| ------------------------------------------- | :---: | :---: | :----: |
| View organization, members, projects, tasks |  Yes  |  Yes  |  Yes   |
| Rename/delete organization; change roles    |  Yes  |  No   |   No   |
| Add members; remove MEMBER                  |  Yes  |  Yes  |   No   |
| Remove ADMIN                                |  Yes  |  No   |   No   |
| Manage projects and tasks                   |  Yes  |  Yes  |   No   |

Task status chỉ chấp nhận:

```text
TODO -> IN_PROGRESS
IN_PROGRESS -> TODO | DONE
DONE -> IN_PROGRESS
```

Status update dùng conditional write, nên hai request cạnh tranh từ cùng trạng thái không thể cùng thành công. Assignment cũng kiểm tra membership lại trong SQL để tránh race khi target user vừa bị xóa khỏi organization.

## Database model

```text
users -> refresh_tokens
users <-> organization_members <-> organizations -> projects -> tasks
```

`organization_members` có composite primary key `(organization_id, user_id)` và role `OWNER | ADMIN | MEMBER`. Xóa organization cascade members, projects và tasks; xóa project cascade tasks.

## Cài đặt và chạy

Yêu cầu: Node.js 20+, npm, Docker và Docker Compose.

```bash
npm install
cp .env.example .env
cp .env.test.example .env.test
docker compose up -d
npm run db:migrate
npm run db:migrate:test
npm run dev
```

API mặc định chạy tại `http://localhost:3000`. Thiết lập `FRONTEND_ORIGIN` thành origin chính xác của TeamFlow Web, ví dụ `http://localhost:3001`; không thêm path vào giá trị này. Thay `JWT_ACCESS_SECRET` bằng secret mạnh, riêng tư trước khi chạy ngoài local.

## Kiểm tra

```bash
npm run format:check
npm run typecheck
npm run build
npm test
```

Tài liệu kiến trúc theo từng feature nằm trong [`docs/`](./docs), còn các bài học Node.js tương ứng nằm trong [`learning/`](./learning).
