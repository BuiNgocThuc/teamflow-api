# Bài 03: JWT, Refresh Token và Authentication Middleware

## JWT là chữ ký, không phải encryption

JWT access token gồm header, payload và signature. Signature giúp server phát
hiện token bị sửa, nhưng payload không được mã hóa. Không đặt password, refresh
token, secret hoặc dữ liệu nhạy cảm vào JWT payload.

Access token của TeamFlow chỉ giữ user ID, email, issue time và expiration.

## Stateless access token và stateful refresh token

JWT access token được verify bằng signature, không cần database lookup mỗi
request. Điều này phù hợp với token ngắn hạn dùng cho protected API.

Refresh token cần logout và rotation, nên application cần state trong database.
TeamFlow dùng random opaque token, lưu SHA-256 hash và expiry. Khi client gửi
refresh token, server hash token đó rồi tìm/update hash trong PostgreSQL.

## Token rotation và race condition

Hai refresh request có thể đến gần như đồng thời với cùng token. Nếu chỉ SELECT
rồi INSERT, cả hai request có thể được chấp nhận.

Thay vào đó, một conditional `UPDATE` atomically consume token:

```text
UPDATE refresh_tokens
SET revoked_at = now()
WHERE token_hash = ?
  AND revoked_at IS NULL
  AND expires_at > now()
RETURNING user_id
```

PostgreSQL đảm bảo một row update là atomic. Request đầu tiên nhận row và tạo
token mới; request còn lại không nhận row, nên bị reject. Đây là ví dụ database
constraint/atomic operation bảo vệ application khỏi race condition.

## Middleware và request context

Authentication middleware chạy trước protected controller. Nó đọc HTTP header:

```text
Authorization: Bearer <access-token>
```

Sau khi verify token, middleware gắn identity tối thiểu vào `request.auth`. Code
sau đó không cần parse JWT lần nữa. Type augmentation cho Express mô tả context
này với TypeScript thay vì dùng `any`.

## Promise error propagation trong Express 5

JWT verification và PostgreSQL query đều trả Promise. Middleware/controller
dùng `await`; khi lỗi có chủ đích, chúng chuyển `AppError` tới centralized error
handler. Lỗi verify token được map thành `401`, còn lỗi hạ tầng bất ngờ vẫn là
`500` và không lộ chi tiết cho client.

## Lifetime trade-off

Access token ngắn hạn giảm cửa sổ rủi ro nếu token bị lộ nhưng buộc client refresh
thường xuyên hơn. Refresh token dài hạn giúp session bền hơn nhưng cần được bảo
vệ, hash ở database, rotate và revoke lúc logout. Rate limiting cho login/refresh
sẽ được thêm khi plan có phase phù hợp.
