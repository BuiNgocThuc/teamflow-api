# Organization Members & RBAC Architecture

## API contract

| Method   | Endpoint                             | Permission                                                        |
| -------- | ------------------------------------ | ----------------------------------------------------------------- |
| `POST`   | `/organizations/:id/members`         | `OWNER` or `ADMIN`; adds target as `MEMBER`.                      |
| `GET`    | `/organizations/:id/members`         | Any organization member.                                          |
| `PATCH`  | `/organizations/:id/members/:userId` | `OWNER`; switches `MEMBER` and `ADMIN`.                           |
| `DELETE` | `/organizations/:id/members/:userId` | `OWNER` may remove `MEMBER`/`ADMIN`; `ADMIN` may remove `MEMBER`. |

The API does not expose an endpoint to assign or remove `OWNER`. Ownership
transfer is deliberately outside Phase 5 so an organization cannot accidentally
lose its only owner.

## Role matrix

| Actor \ Target action | Add MEMBER | Remove MEMBER | Remove ADMIN | Promote MEMBER → ADMIN | Demote ADMIN → MEMBER | Manage OWNER |
| --------------------- | ---------: | ------------: | -----------: | ---------------------: | --------------------: | -----------: |
| OWNER                 |        Yes |           Yes |          Yes |                    Yes |                   Yes |           No |
| ADMIN                 |        Yes |           Yes |           No |                     No |                    No |           No |
| MEMBER                |         No |            No |           No |                     No |                    No |           No |

## Sequence diagrams

### Add organization member

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as authenticate middleware
    participant Controller as Members Controller
    participant Service as Members Service
    participant Repository as Members Repository
    participant DB as PostgreSQL

    Client->>Middleware: POST /organizations/:id/members + {userId}
    Middleware->>Middleware: verify JWT, set request.auth.userId
    Middleware->>Controller: next()
    Controller->>Controller: Zod validate UUID params/body
    Controller->>Service: addOrganizationMember(actorId, organizationId, input)
    Service->>Repository: verify organization exists
    Service->>Repository: find actor membership and role
    alt actor is OWNER or ADMIN
        Service->>Repository: find target user
        Service->>Repository: find existing membership
        alt target is not already a member
            Service->>Repository: INSERT organization_members role=MEMBER
            Repository->>DB: INSERT + SELECT member detail
            DB-->>Controller: 201 Created {member}
        else target already belongs to organization
            Service-->>Client: 409 ORGANIZATION_MEMBER_ALREADY_EXISTS
        end
    else actor is MEMBER or has no membership
        Service-->>Client: 403 authorization error
    end
```

### List members

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as authenticate middleware
    participant Controller as Members Controller
    participant Service as Members Service
    participant Repository as Members Repository
    participant DB as PostgreSQL

    Client->>Middleware: GET /organizations/:id/members
    Middleware->>Middleware: verify JWT, set request.auth.userId
    Middleware->>Controller: next()
    Controller->>Controller: Zod validate organization UUID
    Controller->>Service: listOrganizationMembers(actorId, organizationId)
    Service->>Repository: verify actor membership
    alt actor is a member
        Service->>Repository: JOIN organization_members and users
        Repository->>DB: SELECT public user fields + role
        DB-->>Client: 200 {members}
    else actor has no membership
        Service-->>Client: 403 ORGANIZATION_ACCESS_DENIED
    end
```

### Promote/demote member role

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as authenticate middleware
    participant Controller as Members Controller
    participant Service as Members Service
    participant Repository as Members Repository
    participant DB as PostgreSQL

    Client->>Middleware: PATCH /organizations/:id/members/:userId + {role}
    Middleware->>Middleware: verify JWT, set request.auth.userId
    Middleware->>Controller: next()
    Controller->>Controller: Zod validate UUIDs and role ADMIN/MEMBER
    Controller->>Service: updateOrganizationMemberRole(...)
    Service->>Repository: verify actor is OWNER
    Service->>Repository: find target membership
    alt target is MEMBER or ADMIN and role changes
        Service->>Repository: UPDATE organization_members SET role
        Repository->>DB: UPDATE + SELECT member detail
        DB-->>Client: 200 {member}
    else target is OWNER
        Service-->>Client: 403 ORGANIZATION_OWNER_CANNOT_BE_MANAGED
    else invalid/no-op transition
        Service-->>Client: 400 INVALID_ORGANIZATION_ROLE_TRANSITION
    else actor is not OWNER
        Service-->>Client: 403 ORGANIZATION_OWNER_REQUIRED
    end
```

### Remove member

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as authenticate middleware
    participant Controller as Members Controller
    participant Service as Members Service
    participant Repository as Members Repository
    participant DB as PostgreSQL

    Client->>Middleware: DELETE /organizations/:id/members/:userId
    Middleware->>Middleware: verify JWT, set request.auth.userId
    Middleware->>Controller: next()
    Controller->>Service: removeOrganizationMember(...)
    Service->>Repository: find actor membership and target membership
    alt actor/target role matrix permits removal
        Service->>Repository: DELETE organization_members row
        Repository->>DB: DELETE
        DB-->>Client: 204 No Content
    else target is OWNER or actor lacks permission
        Service-->>Client: 403 authorization error
    end
```

## Module responsibilities

```text
src/modules/organizations/
  organizations.authorization.ts        Shared organization/membership role checks.
  organization-members.schema.ts        Request and route parameter DTO schemas.
  organization-members.controller.ts    HTTP handlers for member APIs.
  organization-members.service.ts       RBAC/business rules and response mapping.
  organization-members.repository.ts    Membership persistence and user join queries.
```

The existing `organization_members` table and `organization_role` enum from
Phase 4 provide the persistence model; Phase 5 adds behavior, not a new table.

## Error responses

| Situation                         | Status | Code                                    |
| --------------------------------- | -----: | --------------------------------------- |
| User is not in organization       |    403 | `ORGANIZATION_ACCESS_DENIED`            |
| MEMBER attempts member management |    403 | `ORGANIZATION_MEMBER_MANAGEMENT_DENIED` |
| Non-owner attempts role update    |    403 | `ORGANIZATION_OWNER_REQUIRED`           |
| Attempt to modify/remove OWNER    |    403 | `ORGANIZATION_OWNER_CANNOT_BE_MANAGED`  |
| Target user is already a member   |    409 | `ORGANIZATION_MEMBER_ALREADY_EXISTS`    |
| Target membership does not exist  |    404 | `ORGANIZATION_MEMBER_NOT_FOUND`         |
| Invalid or no-op role transition  |    400 | `INVALID_ORGANIZATION_ROLE_TRANSITION`  |

## Verification

```bash
docker compose up -d
npm run db:migrate
npm run db:migrate:test
npm test
```

Integration tests cover the OWNER/ADMIN/MEMBER matrix, duplicate membership,
invalid role input, and member listing.
