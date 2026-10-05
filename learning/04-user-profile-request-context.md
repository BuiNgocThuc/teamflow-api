# Bài 04: Authenticated Request Context và Partial Update

## Authentication identity không phải full profile

Access token chỉ nên mang identity tối thiểu cần để authorize request, trong
trường hợp này là user ID và email. Middleware verify token rồi đặt identity vào
`request.auth`.

Profile endpoint vẫn query PostgreSQL theo `request.auth.userId`. Điều này cho
phép trả dữ liệu profile mới nhất, thay vì tin hoàn toàn vào email có thể đã cũ
trong JWT. Ví dụ user đổi email sau khi access token đã được ký.

## Type augmentation ở HTTP boundary

Express `Request` không biết sẵn property `auth`. File declaration merging mở
rộng type `Express.Request`, nên middleware/controller dùng `request.auth` mà
không cần `any` hoặc type assertion.

Đây là type-level convenience; runtime guarantee vẫn đến từ middleware. Vì vậy
controller kiểm tra `request.auth` trước khi dùng, dù route đã có
`authenticate` middleware.

## PATCH và partial update

`PATCH` diễn tả cập nhật một phần resource. Schema cho phép `name` hoặc `email`
optional, nhưng `.refine(...)` yêu cầu ít nhất một field. Nếu cho phép `{}` thì
request thành công nhưng không thay đổi gì, làm API contract mơ hồ.

`.strict()` cũng là boundary protection: field không được phép như
`passwordHash`, `id`, hay `createdAt` bị reject thay vì âm thầm bị bỏ qua.

## Read-before-write race condition

Khi email thay đổi, application check duplicate trước để trả lỗi thân thiện:

```text
Request A: email available
Request B: email available
Request A: UPDATE -> success
Request B: UPDATE -> unique violation
```

Event Loop và `await` cho phép hai request xen kẽ ở các I/O boundary; check trong
service không tạo lock. `UNIQUE(email)` ở PostgreSQL là source of truth. Error
code `23505` được map thành `409 EMAIL_ALREADY_EXISTS`.

## Timestamp lifecycle

`createdAt` chỉ được set khi INSERT. `updatedAt` phải được application hoặc
database trigger cập nhật khi UPDATE. TeamFlow chọn set `updatedAt: new Date()`
trong repository để behavior hiển thị rõ trong code; sau này database trigger là
một lựa chọn khác cần cân nhắc khi có nhiều writer ngoài application.
