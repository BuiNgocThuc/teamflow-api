# Bài 02: Node.js trong User Registration

## 1. Một request đăng ký không chạy tuần tự theo kiểu blocking

Route handler bắt đầu trên JavaScript main thread. Khi code gọi PostgreSQL hoặc
Argon2, handler không nên giữ main thread ở trạng thái chờ bằng một vòng lặp.
Nó tạo async operation, trả quyền điều khiển về Event Loop, rồi tiếp tục khi
Promise hoàn tất.

```text
Request handler
  -> await database query
  -> Event Loop tiếp tục xử lý request khác
  -> database trả kết quả
  -> Promise continuation chạy
```

`await` không tạo JavaScript thread mới. Nó tạm dừng function hiện tại và lên
lịch phần code sau `await` chạy sau khi Promise được resolve/reject.

## 2. PostgreSQL I/O và connection pool

Network communication với PostgreSQL là I/O-bound. Node.js gửi query qua
network socket và không block Event Loop trong lúc chờ PostgreSQL xử lý.

`pg.Pool` giữ một số connection có thể tái sử dụng:

```text
Request A -> mượn connection -> query -> trả connection
Request B -> mượn connection -> query -> trả connection
```

Không tạo `new Pool()` hoặc mở connection mới trong mỗi request. Làm vậy tốn
TCP/database handshake, nhanh cạn connection limit và gây chậm dưới tải.

## 3. Argon2 là CPU-intensive work

Password hashing cố ý tốn tài nguyên để làm brute-force attack khó hơn. Argon2
module cung cấp API Promise; native work không chạy như một vòng lặp JavaScript
đồng bộ trong route handler.

Tuy nhiên, password hashing vẫn tiêu tốn CPU/memory. Nếu lượng register/login
cao, nó có thể tạo áp lực lên thread pool hoặc tài nguyên máy. Đây là lý do
future rate limiting bảo vệ `/auth/register` và `/auth/login` là cần thiết.

Không dùng `crypto.createHash("sha256")` cho password: hash tổng quát quá nhanh
và không được thiết kế để lưu password.

## 4. Promise rejection và Express 5

Controller là async function. Khi Zod parse, service hoặc repository throw,
Promise của controller bị reject. Express 5 nhận rejection này và chuyển nó
tới error middleware.

```text
async controller throws
  -> returned Promise rejects
  -> Express 5 error middleware
  -> safe HTTP error response
```

Do đó controller không cần lặp lại `try/catch` chỉ để gọi `next(error)`.
Centralized error handling giảm duplication và tránh response lỗi không nhất
quán.

## 5. Race condition khi kiểm tra email duplicate

Hai request có thể cùng chạy như sau:

```text
Request A: SELECT email -> not found
Request B: SELECT email -> not found
Request A: INSERT -> success
Request B: INSERT -> conflict
```

Check trong service chỉ giúp response thân thiện; nó không đảm bảo uniqueness.
Constraint `UNIQUE(email)` trong PostgreSQL là source of truth. Error code
`23505` từ PostgreSQL được map về `409 EMAIL_ALREADY_EXISTS`.

## 6. Process lifecycle

`server.ts` mở HTTP server bằng `app.listen`. Process tiếp tục sống vì server
socket còn active. Khi process nhận `SIGINT` hoặc `SIGTERM`, Node.js sẽ cần
graceful shutdown để stop nhận request mới và đóng HTTP server/connection pool.
Phần graceful shutdown sẽ được triển khai khi application có thêm PostgreSQL và
Redis resources cần đóng có chủ đích.
