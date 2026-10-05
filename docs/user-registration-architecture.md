# User Registration Architecture

## Mục tiêu feature

User Registration cho phép client tạo một tài khoản mới qua endpoint:

```http
POST /auth/register
```

Request body:

```json
{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "secure-password"
}
```

Response thành công (`201 Created`) chỉ trả dữ liệu public của user. Password
plaintext và `passwordHash` không được trả về client.

## Request flow

```text
Client
  -> POST /auth/register
  -> express.json() parse JSON body
  -> Auth router
  -> Auth controller
  -> Zod validation
  -> Auth service
  -> Check duplicate email
  -> Argon2id hash password
  -> Auth repository
  -> PostgreSQL via pg connection pool
  -> 201 Created
```

Nếu bất kỳ bước nào ném lỗi, Express 5 chuyển rejected Promise tới centralized
error handler.

```text
ZodError                 -> 400 INVALID_INPUT
Malformed JSON           -> 400 INVALID_JSON
Duplicate email          -> 409 EMAIL_ALREADY_EXISTS
Unexpected infrastructure error -> 500 INTERNAL_SERVER_ERROR
```

## Folder structure

```text
src/
  app.ts
  server.ts
  database/
    client.ts
    schema.ts
    index.ts
  middleware/
    error-handler.ts
    index.ts
  modules/
    index.ts
    auth/
      auth.route.ts
      auth.controller.ts
      auth.schema.ts
      auth.service.ts
      auth.repository.ts
      index.ts
  shared/
    errors/
      app-error.ts
      index.ts
    index.ts

tests/
  integration/
    health.test.ts
    auth/
      register.test.ts

drizzle/
  *.sql
```

## Vai trò từng phần

### `src/app.ts`

Tạo Express application, đăng ký middleware và routes. File này không mở port,
vì vậy test có thể import `app` trực tiếp qua Supertest.

Thứ tự middleware hiện tại:

```text
express.json()
  -> /health route
  -> /auth routes
  -> errorHandler
```

`express.json()` phải đứng trước auth route để request JSON được parse trước khi
controller đọc `request.body`. Error handler phải đứng cuối để nhận lỗi từ
routes/controllers/services.

### `src/server.ts`

Là process entry point. File này nạp `.env`, kiểm tra `PORT`, sau đó gọi
`app.listen(...)` để Node.js HTTP server bắt đầu lắng nghe network socket.

`server.ts` không chứa route hoặc business logic.

### `src/modules/auth/`

Đây là vertical slice của Authentication. Mỗi file có một trách nhiệm:

| File                 | Trách nhiệm                                                              |
| -------------------- | ------------------------------------------------------------------------ |
| `auth.route.ts`      | Khai báo `POST /register` và nối route với controller.                   |
| `auth.controller.ts` | Chuyển HTTP request thành lời gọi application; trả HTTP `201`.           |
| `auth.schema.ts`     | Xác định request contract và tạo `RegisterInput` từ Zod.                 |
| `auth.service.ts`    | Business rules: duplicate email, password hashing, map unique violation. |
| `auth.repository.ts` | Đọc/ghi `users` bằng Drizzle/PostgreSQL.                                 |
| `index.ts`           | Public exports của auth module cho code ngoài module.                    |

Controller không chứa SQL. Repository không biết HTTP status. Service không phụ
thuộc Express `Request` hoặc `Response`.

### `src/database/`

`schema.ts` mô tả bảng `users`: UUID primary key, `email` unique, password hash
và timestamps. Drizzle dùng schema này để tạo migration SQL.

`client.ts` tạo một `pg.Pool` và Drizzle database client. Pool tái sử dụng
PostgreSQL connections thay vì tạo một connection mới cho mỗi request.

### `src/middleware/` và `src/shared/`

`error-handler.ts` là Express error middleware. Nó chuyển các error type nội bộ
thành HTTP response an toàn cho client.

`AppError` trong `shared/errors/` là error có chủ đích từ application logic,
chứa `statusCode`, error `code` và message. Ví dụ duplicate email là một domain
error, không phải lỗi bất ngờ của server.

### `tests/integration/`

Integration test chạy Express app, validation, service, repository và
PostgreSQL test database cùng nhau. Test không nằm trong `src/` vì nó không
phải production code.

Mỗi test dọn bảng `users` sau khi chạy và đóng connection pool sau suite. Test
database là `teamflow_test`, tách biệt với development database `teamflow`.

### `drizzle/`

Chứa migration SQL được generate từ schema. Migration là lịch sử thay đổi cấu
trúc database, cần commit cùng source code; không coi nó là build output.

## Data integrity và security

Email được trim/lowercase trước khi query. Service check duplicate để trả lỗi
rõ ràng, còn PostgreSQL `UNIQUE(email)` là lớp bảo vệ cuối cùng khi hai request
đồng thời cùng đăng ký một email.

Password được hash bằng Argon2id trước khi persistence. Database chỉ lưu
`password_hash`; response repository cũng chỉ select các public fields.

## Commands

```bash
docker compose up -d
npm run db:migrate
npm run db:migrate:test
npm test
```

`db:migrate` dùng `.env` cho database development. `db:migrate:test` dùng
`.env.test` cho database test.
