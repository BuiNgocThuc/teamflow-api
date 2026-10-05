# Bài 01: Node.js Runtime, HTTP và Express

## Mục tiêu

Hiểu điều gì xảy ra khi khởi động một Node.js backend, vị trí của Express trong
kiến trúc, đường đi của HTTP request và lý do Node.js có thể xử lý nhiều tác vụ
I/O dù JavaScript chủ yếu chạy trên một main thread.

## 1. Khi chạy một backend Node.js

Khi chạy một lệnh như `npm run dev`, một công cụ sẽ khởi chạy Node.js với file
entry point của ứng dụng. Trong môi trường phát triển, `tsx` có thể chạy trực
tiếp TypeScript; trong production, Node.js chạy JavaScript đã được biên dịch.

Backend không chạy xong rồi dừng như một script tính toán. Nó thường:

1. Khởi tạo Node.js process.
2. Tải và thực thi file entry point.
3. Tạo HTTP server.
4. Yêu cầu hệ điều hành lắng nghe một cổng mạng, ví dụ `3000`.
5. Chờ các sự kiện như HTTP request, I/O hoàn tất, timer hoặc tín hiệu tắt.
6. Xử lý sự kiện qua Event Loop cho tới khi process kết thúc.

```text
Terminal
  -> Node.js runtime tạo process
  -> process thực thi entry point
  -> HTTP server lắng nghe port
  -> Event Loop chờ và điều phối sự kiện
```

## 2. Node.js process là gì?

Process là một chương trình đang chạy do hệ điều hành quản lý. Mỗi process
Node.js có vùng nhớ riêng, Process ID (PID), JavaScript call stack, Event Loop,
và quyền mở network socket hoặc kết nối tới database.

Hai bản API chạy trên hai port thường là hai process riêng. Biến trong bộ nhớ
của process này không tự xuất hiện ở process kia. Khi cần chia sẻ dữ liệu, dùng
một cơ chế tường minh như database, cache, message queue hoặc IPC.

## 3. Vai trò của Node.js runtime

JavaScript không tự có khả năng mở HTTP server, đọc file hoặc truy vấn database.
Node.js là runtime cung cấp môi trường để JavaScript chạy trên máy chủ và làm
những việc đó.

Các thành phần quan trọng:

- **V8**: JavaScript engine thực thi JavaScript.
- **Node.js APIs**: các API như `node:http`, `node:fs`, `node:net`, `process`
  và `stream`.
- **libuv**: hỗ trợ Event Loop, I/O bất đồng bộ, timer và thread pool cho một
  số tác vụ.
- **Hệ điều hành**: quản lý socket mạng, file, process và lịch chạy CPU.

TypeScript không phải runtime. Nó kiểm tra kiểu và được chuyển thành JavaScript
trước hoặc ngay khi chạy trong môi trường phát triển.

## 4. Express nằm ở đâu?

Express là thư viện JavaScript chạy bên trong Node.js process. Nó không thay
thế Node.js và không phải một HTTP server độc lập.

```text
Hệ điều hành
  -> Node.js HTTP server
  -> Express application
  -> middleware
  -> route handler
```

Node.js phụ trách tầng thấp: lắng nghe port, nhận dữ liệu mạng, hiểu giao thức
HTTP và tạo request/response object. Express cung cấp lớp tiện dụng hơn cho
routing, middleware, JSON response và xử lý lỗi.

## 5. HTTP server của Node.js

Một HTTP server Node.js sẽ yêu cầu hệ điều hành lắng nghe trên một port. Khi
client gửi HTTP request, hệ điều hành nhận dữ liệu mạng và Node.js được thông
báo. Node.js tạo đối tượng request và response, sau đó gọi request handler của
ứng dụng.

Request ví dụ:

```http
GET /health HTTP/1.1
Host: localhost:3000
Accept: application/json
```

Response ví dụ:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"ok"}
```

## 6. Express sử dụng HTTP server như thế nào?

Một Express application là request handler tương thích với HTTP server của
Node.js. Khi Node.js nhận request, nó chuyển request đó vào Express. Express
sau đó lần lượt chạy middleware phù hợp, tìm route khớp và gọi route handler.

```text
Node.js HTTP server nhận request
  -> Express application nhận req và res
  -> Express chạy middleware theo thứ tự đăng ký
  -> Express tìm route phù hợp
  -> route handler tạo response
```

## 7. Đường đi của request `GET /health`

```text
Client (browser, curl hoặc Postman)
  -> HTTP request tới localhost:3000
  -> Hệ điều hành chuyển dữ liệu vào socket Node.js đang lắng nghe
  -> Node.js HTTP server nhận request
  -> Express application nhận request/response
  -> middleware chạy theo thứ tự đã đăng ký
  -> Express tìm route GET /health
  -> route handler chạy và trả JSON
  -> Node.js gửi HTTP response về client
```

Thứ tự middleware rất quan trọng vì Express xử lý chúng theo đúng thứ tự đăng
ký. Ví dụ logging, parse JSON, authentication và error handler cần được đặt có
chủ đích.

Endpoint health chỉ xác nhận process đang chạy, HTTP server đang lắng nghe và
routing hoạt động. Nó chưa xác nhận database, authentication hoặc business
logic hoạt động.

## 8. Event Loop tham gia ở đâu?

Event Loop là cơ chế cho phép Node.js nhận biết và xử lý các sự kiện có thể
chạy, như network event, timer và I/O đã hoàn tất. Node.js không cần dùng vòng
lặp JavaScript để liên tục dò request mạng; hệ điều hành và libuv hỗ trợ theo
dõi I/O hiệu quả.

Ví dụ khi handler truy vấn database:

```text
Route handler bắt đầu
  -> gửi query đến PostgreSQL
  -> function tạm dừng tại await
  -> Event Loop tiếp tục phục vụ công việc khác
  -> PostgreSQL trả kết quả
  -> Promise được hoàn tất
  -> phần code sau await được lên lịch chạy
  -> response được gửi về client
```

`await` không tạo một JavaScript thread mới. Nó tạm dừng function hiện tại để
main thread có thể chạy các callback khác trong lúc chờ I/O.

## 9. Vì sao Node.js xử lý được nhiều request?

Phân biệt hai khái niệm:

- **Concurrency**: nhiều công việc cùng tồn tại và tiến triển xen kẽ.
- **Parallelism**: nhiều công việc thực sự chạy đồng thời trên nhiều CPU core.

Một Node.js process thường thực thi JavaScript trên một main thread. Tuy nhiên,
phần lớn công việc backend là I/O-bound: chờ database, network, file system hay
dịch vụ bên ngoài phản hồi. Trong thời gian chờ, main thread không cần bị giữ;
Event Loop có thể xử lý request khác.

Hệ điều hành xử lý network I/O, PostgreSQL chạy ở process khác, và libuv có
thread pool cho một số loại công việc như file system, DNS kiểu nhất định hoặc
crypto. JavaScript callback chỉ cần chạy khi kết quả sẵn sàng.

### Cảnh báo: CPU-bound work

Event Loop không loại bỏ giới hạn của main thread. Nếu route chạy tác vụ đồng
bộ nặng về CPU, như vòng lặp dài, nén dữ liệu lớn hoặc xử lý ảnh, main thread
bị chặn. Khi đó các request khác trong cùng process không thể được xử lý kịp.

## 10. Thiết kế bootstrap tối giản

Khi bắt đầu implementation, cấu trúc phù hợp là:

```text
src/
  app.ts       # cấu hình Express app và route
  server.ts    # khởi động HTTP server, lắng nghe PORT
learning/
  01-nodejs-runtime-http-express.md
```

Tách `app.ts` và `server.ts` giúp tách cấu hình Express khỏi việc mở network
port. Nhờ vậy, test có thể import app mà không cần thực sự lắng nghe một port.

Không cần tạo router/controller/service/repository cho health endpoint. Một
route trực tiếp trong app là đơn giản và phù hợp nhất cho bài đầu tiên.

## 11. Lộ trình implementation

1. Đọc và hiểu cấu hình TypeScript hiện có.
2. Tạo Express application trong `app.ts`.
3. Thêm route `GET /health` trả về `{"status":"ok"}`.
4. Tạo `server.ts` để lắng nghe port từ biến môi trường.
5. Chạy server, gọi endpoint và quan sát request/response.
6. Review implementation trước khi đi tới middleware hoặc testing.
