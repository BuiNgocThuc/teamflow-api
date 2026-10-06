# Bài 05: Many-to-Many Relationship, Transaction và Ownership

## 1. Organization membership là many-to-many relationship

Một user có thể thuộc nhiều organization; một organization có nhiều user. Không
đặt `organization_id` trực tiếp trên `users`, vì cách đó chỉ cho phép một user
thuộc một organization.

Join table `organization_members` lưu relationship và metadata của relationship:

```text
organization_id
user_id
role
created_at
```

Composite primary key `(organization_id, user_id)` là database guarantee rằng
một user không thể có hai membership trong cùng organization.

## 2. Transaction bảo vệ atomic operation

Create organization thực ra là hai database writes:

```text
INSERT organizations
INSERT organization_members (role = OWNER)
```

Nếu insert organization thành công nhưng membership thất bại, data sẽ sai: một
organization không có owner. Transaction đảm bảo all-or-nothing:

```text
BEGIN
  create organization
  create owner membership
COMMIT

any failure -> ROLLBACK
```

Trong lúc chờ PostgreSQL response, Node.js Event Loop vẫn có thể phục vụ request
khác. Transaction giữ database consistency, không block JavaScript main thread.

## 3. Authentication và authorization khác nhau

Authentication trả lời: “request này là ai?” Access-token middleware verify JWT
và tạo `request.auth.userId`.

Authorization trả lời: “user này có được làm action trên resource này không?”
Organization service query membership rồi kiểm tra role.

```text
No valid token             -> 401
Valid token, no membership -> 403
Member, not owner          -> 403
Owner                      -> action allowed
```

## 4. Foreign key cascade

`organization_members.organization_id` reference organization với `ON DELETE
CASCADE`. Khi owner delete organization, PostgreSQL tự xóa memberships liên quan
trong operation đó. Application không phải tự query và delete từng membership.

Cascade phù hợp khi child row không có ý nghĩa nếu parent không tồn tại. Cần cẩn
thận: delete parent là destructive operation có side effect xuống child rows.

## 5. Validate path parameters

Express params có thể là `string | string[]`; không nên coi `:id` là UUID hợp lệ
mặc định. Zod validation tại controller biến untrusted path input thành UUID
string đã validate, đồng thời TypeScript không cần type assertion.
