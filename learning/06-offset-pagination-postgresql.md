# Bài 06: Offset Pagination với Express, Drizzle và PostgreSQL

## HTTP query parameters luôn bắt đầu là string

Request:

```http
GET /organizations?page=2&limit=20
```

Express nhận `request.query` từ HTTP query string. Không nên tin rằng `page`
và `limit` đã là number; Zod coercion chuyển và validate chúng ở boundary.

```text
"2" -> 2
"20" -> 20
```

Validation trước service tránh các giá trị như `page=0`, `limit=-1`, `limit=999`
đi xuống repository/database.

## LIMIT và OFFSET

PostgreSQL xử lý page bằng hai phần:

```text
LIMIT  = số row tối đa trả về
OFFSET = số row bỏ qua trước khi trả về
```

Formula:

```text
offset = (page - 1) * limit
```

| Page | Limit | Offset | Rows được yêu cầu |
| ---: | ----: | -----: | ----------------- |
|    1 |    20 |      0 | 1–20              |
|    2 |    20 |     20 | 21–40             |
|    3 |    20 |     40 | 41–60             |

`ORDER BY` là bắt buộc về mặt product semantics. Không có order ổn định,
PostgreSQL không cam kết row nào thuộc page nào. Organization list chọn
`created_at DESC, id DESC` để newest organization xuất hiện trước và `id` làm
tie-breaker khi timestamp trùng nhau.

## COUNT và Promise.all

Page response cần hai query:

```text
data query  -> rows cho page hiện tại
count query -> tổng số rows user được quyền xem
```

Hai query đều là asynchronous PostgreSQL I/O. Khi Promise chờ database, Node.js
Event Loop có thể xử lý request khác. `Promise.all` khởi động cả hai query mà
không đợi query kia hoàn thành trước.

Đây là concurrency, không phải JavaScript parallel CPU computation. PostgreSQL
và network I/O thực hiện phần việc bên ngoài JavaScript main thread.

## Snapshot consistency trade-off

Nếu organization membership thay đổi giữa data query và count query, metadata
có thể không hoàn toàn trùng với data page. Muốn strict snapshot consistency
cần transaction/isolation phù hợp, nhưng chi phí và complexity không cần thiết
cho list Organization hiện tại.

## Khi nào dùng cursor pagination

Offset càng lớn càng khiến database phải bỏ qua nhiều row. Cursor pagination
thường tốt hơn với dataset lớn hoặc infinite scrolling:

```text
GET /tasks?cursor=<createdAt,id>&limit=20
```

Cursor dùng key order ổn định, ví dụ `(created_at, id)`, nên tránh large offset
và ít bị page drift hơn. Nhưng nó không phù hợp bằng offset khi UI cần jump trực
tiếp tới “page 17” hoặc hiển thị total pages.
