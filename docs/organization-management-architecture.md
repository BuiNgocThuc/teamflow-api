# Organization Management Architecture

## API contract

| Method   | Endpoint             | Purpose                                                 |
| -------- | -------------------- | ------------------------------------------------------- |
| `POST`   | `/organizations`     | Create an organization and owner membership.            |
| `GET`    | `/organizations`     | List organizations belonging to the authenticated user. |
| `GET`    | `/organizations/:id` | Read an organization when the user is a member.         |
| `PATCH`  | `/organizations/:id` | Rename an organization when the user is its owner.      |
| `DELETE` | `/organizations/:id` | Delete an organization when the user is its owner.      |

Create/update bodies use the same shape:

```json
{
    "name": "Engineering"
}
```

All endpoints require a bearer access token. Phase 4 creates the role model;
only `OWNER` authorization is needed for update/delete. Phase 5 will add member
management and full `OWNER`/`ADMIN`/`MEMBER` authorization rules.

## Persistence model

```text
users
  -> organization_members <- organizations
```

`organization_members` is the many-to-many join table. Its composite primary
key `(organization_id, user_id)` ensures one membership per user/organization
pair. Both foreign keys use `ON DELETE CASCADE`.

The role enum supports `OWNER`, `ADMIN`, and `MEMBER`. The creator receives
`OWNER` at creation time.

## Sequence diagrams

### Create organization and owner membership

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as authenticate middleware
    participant Controller as Organizations Controller
    participant Service as Organizations Service
    participant Repository as Organizations Repository
    participant DB as PostgreSQL

    Client->>Middleware: POST /organizations + Bearer token + {name}
    Middleware->>Middleware: verify JWT, set request.auth.userId
    Middleware->>Controller: next()
    Controller->>Controller: Zod validate name
    Controller->>Service: createOrganization(userId, input)
    Service->>Repository: createWithOwner(userId, name)
    Repository->>DB: BEGIN
    Repository->>DB: INSERT organizations
    Repository->>DB: INSERT organization_members role=OWNER
    alt both inserts succeed
        Repository->>DB: COMMIT
        Repository-->>Service: organization
        Service-->>Controller: organization
        Controller-->>Client: 201 Created
    else either insert fails
        Repository->>DB: ROLLBACK
        Repository-->>Controller: error
        Controller-->>Client: error handler response
    end
```

### Read organization/list organizations

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as authenticate middleware
    participant Controller as Organizations Controller
    participant Service as Organizations Service
    participant Repository as Organizations Repository
    participant DB as PostgreSQL

    Client->>Middleware: GET /organizations or /organizations/:id
    Middleware->>Middleware: verify JWT, set request.auth.userId
    Middleware->>Controller: next()
    alt list
        Controller->>Service: listOrganizations(userId)
        Service->>Repository: listForUser(userId)
        Repository->>DB: JOIN memberships and organizations
        DB-->>Client: 200 organizations with role
    else get by id
        Controller->>Controller: Zod validate UUID path parameter
        Controller->>Service: getOrganization(userId, organizationId)
        Service->>Repository: findById(organizationId)
        Repository->>DB: SELECT organization
        DB-->>Repository: organization or null
        alt organization exists
            Service->>Repository: findMembership(userId, organizationId)
            Repository->>DB: SELECT organization membership
            DB-->>Repository: membership or null
            alt user is a member
                Repository-->>Service: membership
                Service-->>Controller: organization
                Controller-->>Client: 200 organization
            else user is not a member
                Service-->>Client: 403 ORGANIZATION_ACCESS_DENIED
            end
        else organization does not exist
            Service-->>Client: 404 ORGANIZATION_NOT_FOUND
        end
    end
```

### Update or delete organization

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as authenticate middleware
    participant Controller as Organizations Controller
    participant Service as Organizations Service
    participant Repository as Organizations Repository
    participant DB as PostgreSQL

    Client->>Middleware: PATCH or DELETE /organizations/:id
    Middleware->>Middleware: verify JWT, set request.auth.userId
    Middleware->>Controller: next()
    Controller->>Controller: validate UUID and PATCH body
    Controller->>Service: updateOrganization or deleteOrganization
    Service->>Repository: findById(organizationId)
    Repository->>DB: SELECT organization
    DB-->>Repository: organization or null
    alt organization exists
        Service->>Repository: findMembership(userId, organizationId)
        Repository->>DB: SELECT organization membership
        DB-->>Repository: membership or null
        alt membership role is OWNER
            alt PATCH
                Service->>Repository: updateName(id, name)
                Repository->>DB: UPDATE organizations SET name, updated_at
                DB-->>Client: 200 updated organization
            else DELETE
                Service->>Repository: deleteById(id)
                Repository->>DB: DELETE organization
                Note over DB: Cascades delete organization_members
                DB-->>Client: 204 No Content
            end
        else user is not an owner
            Service-->>Client: 403 access denied or owner required
        end
    else organization does not exist
        Service-->>Client: 404 ORGANIZATION_NOT_FOUND
    end
```

## Module responsibilities

```text
src/modules/organizations/
  organizations.route.ts       Authenticated route declarations.
  organizations.controller.ts  HTTP request/response mapping.
  organizations.schema.ts      Zod body and UUID path validation.
  organizations.service.ts     Membership/owner authorization rules.
  organizations.repository.ts  Transaction and PostgreSQL queries.
```

`getAuthenticatedUserId` is shared because multiple controllers convert the
authentication middleware context into an application-level user ID.

## Error responses

| Situation                          | Status | Code                           |
| ---------------------------------- | -----: | ------------------------------ |
| Missing/invalid bearer token       |    401 | Authentication middleware code |
| Invalid UUID or organization name  |    400 | `INVALID_INPUT`                |
| Authenticated user is not a member |    403 | `ORGANIZATION_ACCESS_DENIED`   |
| Member without owner permission    |    403 | `ORGANIZATION_OWNER_REQUIRED`  |
| Organization no longer exists      |    404 | `ORGANIZATION_NOT_FOUND`       |

## Verification

```bash
docker compose up -d
npm run db:generate
npm run db:migrate
npm run db:migrate:test
npm test
```

Integration tests cover create, creator ownership, list, get, owner update,
unauthorized update, delete, authentication, and validation.
