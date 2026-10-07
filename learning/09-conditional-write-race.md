# Bài 09: Conditional Write và Time-of-Check/Time-of-Use

Một flow ngây thơ để assign task có hai câu query độc lập: kiểm tra membership,
rồi update `tasks.assignee_id`. Giữa hai lần database I/O đó, request khác có
thể xoá membership. Event loop không làm hai database operation thành atomic;
`await` trả quyền chạy lại cho Node khi Promise đang chờ PostgreSQL.

Phase 8 vẫn kiểm tra membership trước để trả error rõ ràng, nhưng SQL update
có thêm điều kiện `EXISTS` trên `organization_members`. PostgreSQL chỉ ghi task
nếu assignee còn là member tại đúng thời điểm statement chạy. Đây là một
conditional write: kiểm tra business invariant ngay trong mutation.

Với invariant phức tạp hơn, nhiều row cần thay đổi cùng lúc, hoặc cần bảo vệ
role của actor, transaction và locking có thể phù hợp hơn. Chúng có trade-off:
giữ lock lâu hơn làm request cạnh tranh phải chờ, nên chỉ dùng khi invariant
thật sự cần atomicity rộng hơn một SQL statement.
