# TeamFlow API

Backend API phục vụ một ứng dụng cộng tác nhóm, được xây dựng với mục tiêu học
tập. Dự án dùng Express và TypeScript để làm rõ vòng đời request của Node.js,
I/O bất đồng bộ, xử lý lỗi và tích hợp PostgreSQL trước khi sử dụng các
framework cấp cao hơn.

## Công nghệ sử dụng

- Node.js and TypeScript
- Express
- PostgreSQL (sẽ được tích hợp ở các bước tiếp theo)
- Zod để kiểm tra dữ liệu tại ranh giới hệ thống
- Pino để ghi log HTTP có cấu trúc
- Vitest và Supertest để kiểm thử

## Bắt đầu

Yêu cầu: Node.js 20 trở lên và npm.

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run dev` khởi chạy file entry point TypeScript bằng `tsx watch`; tiến
trình sẽ tự khởi động lại khi mã nguồn thay đổi. Scaffold ban đầu chưa có API
route, vì vậy cần thêm route trước khi mong đợi server phản hồi.

## Biến môi trường

Sao chép `.env.example` thành `.env` rồi điều chỉnh giá trị cho máy của bạn.
Git bỏ qua `.env` vì file có thể chứa thông tin xác thực; `.env.example` là
mẫu an toàn được commit.

| Biến           | Mục đích                                          | Giá trị mặc định                |
| -------------- | ------------------------------------------------- | ------------------------------- |
| `NODE_ENV`     | Môi trường chạy ứng dụng                          | `development`                   |
| `PORT`         | Cổng HTTP mà server sẽ lắng nghe                  | `3000`                          |
| `LOG_LEVEL`    | Ngưỡng mức log của Pino                           | `info`                          |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL cho tầng dữ liệu sau này | Cơ sở dữ liệu `teamflow` cục bộ |

## Scripts

| Lệnh            | Mục đích                                             |
| --------------- | ---------------------------------------------------- |
| `npm run dev`   | Chạy server phát triển với khả năng tự khởi động lại |
| `npm run build` | Biên dịch TypeScript sang `dist/`                    |
| `npm start`     | Chạy server đã biên dịch                             |
| `npm test`      | Chạy Vitest                                          |

## Luồng request dự kiến

```text
HTTP request
  -> Express router
  -> middleware (request ID, logging, validation, auth)
  -> controller
  -> service
  -> repository
  -> PostgreSQL
```

Mỗi tầng có một trách nhiệm hẹp: route kết hợp các concern HTTP, controller ánh
xạ HTTP sang lời gọi ứng dụng, service chứa quy tắc nghiệp vụ, còn repository
quản lý SQL/persistence. Đối tượng Express `Request` và `Response` không nên
đi vào service.

## Lưu ý khi phát triển

Node.js xử lý công việc mạng và cơ sở dữ liệu một cách bất đồng bộ, cho phép
event loop phục vụ request khác trong khi I/O đang chờ. Không đặt tác vụ đồng
bộ nặng về CPU trong request handler, vì chúng chặn mọi request dùng chung tiến
trình. Khi kết nối database, dự án sẽ dùng connection pool thay vì mở một kết
nối mới cho từng request.

Các bước triển khai tiếp theo được giữ nhỏ và rõ ràng:

1. Tạo ứng dụng Express và health endpoint.
2. Thêm xử lý lỗi tập trung và request logging có cấu trúc.
3. Kết nối PostgreSQL qua pool, sau đó tạo feature module đầu tiên.
4. Thêm API test tập trung vào hành vi bằng Vitest và Supertest.
