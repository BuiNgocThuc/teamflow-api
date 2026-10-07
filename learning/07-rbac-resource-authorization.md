# Bài 07: RBAC và Resource-Based Authorization

## Authentication không đủ để authorize action

JWT authentication trả lời: “request này là user nào?” Middleware verify token
và đặt identity vào `request.auth`.

RBAC trả lời: “user này có role nào trên organization cụ thể, và role đó có được
làm action này không?” Một user có thể là `OWNER` trong organization A nhưng là
`MEMBER` trong organization B, nên role không thuộc global user profile; nó nằm
trong join table `organization_members`.

## Role matrix là business rule có thể test

Không nên viết rải rác các `if` thiếu cấu trúc trong controller. Service đọc
actor membership và target membership, sau đó áp dụng matrix:

```text
OWNER -> manage MEMBER and ADMIN, never OWNER
ADMIN -> add/remove MEMBER only
MEMBER -> no member-management actions
```

Integration test role matrix bảo vệ behavior khi Phase 5/6 thêm role hoặc action
mới. Test không chỉ kiểm tra `403`; nó kiểm tra actor role, target role và action
cụ thể.

## Resource-based authorization

Authorization luôn cần cả ba dữ liệu:

```text
actor user ID
organization ID
target user ID (nếu quản lý member khác)
```

Service query membership theo `(user_id, organization_id)`. Không thể chỉ kiểm
tra role của user mà không có organization ID, vì cùng user có role khác nhau ở
mỗi organization.

## Time-of-check và time-of-use

Member service check role trước khi update/delete. Trong hệ thống có concurrency
cao, membership có thể thay đổi giữa check và action. Phase hiện tại đã có
database composite primary key và foreign keys để bảo vệ integrity, nhưng chưa
dùng row lock hoặc version column.

Khi action trở nên nhạy cảm hơn, ví dụ transfer ownership hoặc billing, có thể
cần transaction và conditional update/locking để role check và mutation cùng
nằm trong một atomic boundary.

## Vì sao không cho manage OWNER

Owner là role đảm bảo organization có người quản trị cuối cùng. Không cho API
member management remove/demote owner tránh organization không owner hoặc admin
tự nâng quyền qua một đường không rõ ràng. Ownership transfer là business flow
riêng, cần transaction và rule riêng, nên không đưa vào Phase 5.
