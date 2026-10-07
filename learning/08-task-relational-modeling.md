# Bài 08: Relational Modeling cho Task

`tasks` giữ `project_id` thay vì trực tiếp giữ `organization_id`. Organization
được suy ra qua đường `task -> project -> organization`, nhờ vậy chỉ có một
nguồn dữ liệu xác định project thuộc organization nào. Lưu thêm `organization_id`
trong task sẽ nhanh hơn cho vài query nhưng tạo dữ liệu trùng lặp và cần cơ chế
giữ hai cột luôn đồng bộ.

Foreign key là hàng rào cuối cùng của database: application có bug vẫn không thể
tạo task cho project không tồn tại. `ON DELETE CASCADE` là lựa chọn hợp lý cho
`project -> task`, vì task không có ý nghĩa nếu project cha đã bị xoá.

Service vẫn kiểm tra quyền trước khi insert/update/delete. Foreign key trả lời
“project có tồn tại không?”, còn authorization trả lời “user hiện tại có được
làm action này trong organization chứa project không?”. Đây là hai rule khác
nhau và đều cần thiết.

`Promise.all` trong list repository gửi query lấy trang dữ liệu và query `COUNT`
cùng lúc. Node không chờ block cho từng database query: `pg` đăng ký I/O với
event loop, rồi Promise tiếp tục khi PostgreSQL trả kết quả. Hai query vẫn dùng
connection pool và không phải hai CPU thread JavaScript.

Phase 7 cố ý không cho `PATCH /tasks/:id` đổi `status` hay `assigneeId`.
Phase 8 và 9 sẽ biến chúng thành business operations riêng, để assignment và
state transition có thể kiểm soát invariant thay vì bị một CRUD endpoint bỏ qua.
