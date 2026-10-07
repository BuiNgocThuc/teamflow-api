# Bài 10: Optimistic Concurrency cho State Transition

Trong Node.js, hai request có thể cùng đọc task ở trạng thái `TODO`, rồi mỗi
request chờ PostgreSQL qua `await`. Nếu mỗi request dùng update không điều kiện,
cả hai đều có thể ghi và application mất cơ hội phát hiện conflict.

Workflow dùng compare-and-set ở SQL:

```text
UPDATE tasks
SET status = 'IN_PROGRESS'
WHERE id = :taskId AND status = 'TODO'
```

Một request thắng sẽ đổi status. Request còn lại nhận zero rows vì điều kiện
`status = TODO` không còn đúng. Không cần giữ lock trong lúc Node xử lý request,
nên đây là optimistic concurrency: giả định conflict hiếm, kiểm tra conflict
ngay khi ghi.

Status hiện tại đóng vai trò expected version. Khi update nhiều field không có
state rõ ràng, một integer `version` tăng mỗi lần update có thể là lựa chọn tốt
hơn; client gửi version đã đọc và update chỉ thành công khi version còn khớp.
