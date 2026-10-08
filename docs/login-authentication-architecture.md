# Login & Authentication Architecture

## API contract

| Endpoint             | Purpose                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| `POST /auth/login`   | Verify email/password, return an access token, and set a refresh-token cookie. |
| `POST /auth/refresh` | Consume the refresh-token cookie and issue a rotated access/cookie pair.       |
| `POST /auth/logout`  | Revoke the refresh-token cookie value and clear the cookie.                    |
| `GET /users/me`      | Read the authenticated user's persisted profile.                               |

`POST /auth/login` accepts:

```json
{
    "email": "jane@example.com",
    "password": "secure-password"
}
```

Successful login and refresh return:

```json
{
    "accessToken": "jwt"
}
```

The raw refresh token is sent only in a `Set-Cookie` header, never in JSON.
The cookie is named `teamflow_refresh_token` and is `HttpOnly`, `SameSite=Lax`,
scoped to `/auth`, and `Secure` in production.

## Token design

Access tokens are short-lived JWTs signed with HS256. They contain only the
subject user ID and email needed by the authentication middleware.

Refresh tokens are high-entropy random values, not JWTs. The API returns the raw
value once, but PostgreSQL stores only its SHA-256 hash. This gives logout and
refresh rotation server-side state while limiting the impact of a database leak.

## Sequence diagrams

### Login

```mermaid
sequenceDiagram
    participant Client
    participant Router as Auth Router
    participant Controller as Auth Controller
    participant Service as Auth Service
    participant Repository as Auth Repository
    participant DB as PostgreSQL

    Client->>Router: POST /auth/login {email, password}
    Router->>Controller: login(request, response)
    Controller->>Controller: Zod validate request body
    Controller->>Service: loginUser(credentials)
    Service->>Repository: findByEmail(email)
    Repository->>DB: SELECT user by email
    DB-->>Repository: user + password_hash
    Repository-->>Service: user
    Service->>Service: argon2.verify(password_hash, password)
    Service->>Service: sign JWT access token
    Service->>Service: generate random refresh token + SHA-256 hash
    Service->>Repository: createRefreshToken(hash, expiry)
    Repository->>DB: INSERT refresh_tokens
    DB-->>Repository: inserted
    Repository-->>Service: complete
    Service-->>Controller: accessToken + raw refreshToken
    Controller->>Client: Set-Cookie: teamflow_refresh_token=raw token; HttpOnly
    Controller-->>Client: 200 {accessToken}
```

### Protected endpoint

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as authenticate middleware
    participant Token as JWT verifier
    participant Controller as Users Controller

    Client->>Middleware: GET /users/me + Authorization: Bearer token
    Middleware->>Token: verify signature, HS256 algorithm, expiry
    Token-->>Middleware: userId + email claims
    Middleware->>Middleware: request.auth = claims
    Middleware->>Controller: next()
    Controller-->>Client: 200 OK {user}
```

### Refresh-token rotation

```mermaid
sequenceDiagram
    participant Client
    participant Service as Auth Service
    participant Repository as Auth Repository
    participant DB as PostgreSQL

    Client->>Service: POST /auth/refresh + refresh-token cookie
    Service->>Service: SHA-256(refreshToken)
    Service->>Service: generate next raw refresh token + hash
    Service->>Repository: rotateRefreshToken(currentHash, nextHash)
    Repository->>DB: BEGIN
    Repository->>DB: UPDATE active, unexpired token to revoked
    DB-->>Repository: user_id or no row
    alt valid token
        Repository->>DB: INSERT replacement refresh token
        Repository->>DB: COMMIT
        Repository-->>Service: user identity
        Service->>Service: sign next access token
        Service-->>Client: 200 OK {accessToken} + rotated Set-Cookie
    else invalid, expired, revoked, or replayed token
        Repository->>DB: COMMIT without changes
        Repository-->>Service: null
        Service-->>Client: 401 INVALID_REFRESH_TOKEN
    end
```

### Logout

```mermaid
sequenceDiagram
    participant Client
    participant Service as Auth Service
    participant Repository as Auth Repository
    participant DB as PostgreSQL

    Client->>Service: POST /auth/logout + refresh-token cookie
    Service->>Service: SHA-256(refreshToken)
    Service->>Repository: revokeRefreshToken(tokenHash)
    Repository->>DB: UPDATE refresh_tokens SET revoked_at = now()
    DB-->>Repository: complete
    Repository-->>Service: complete
    Service-->>Client: 204 No Content + cleared Set-Cookie
```

```text
Login
  -> verify Argon2 password hash
  -> sign short-lived JWT access token
  -> generate random refresh token
  -> hash refresh token
  -> persist hash and expiry
  -> send raw refresh token once in a Set-Cookie header
```

## Refresh rotation

```text
POST /auth/refresh
  -> read refresh token from the HttpOnly cookie and hash it
  -> atomically mark matching active token revoked
  -> create a replacement token row in the same transaction
  -> sign new access token
  -> return new token pair
```

The repository revokes the old token with a conditional update requiring:

- matching token hash;
- `revoked_at IS NULL`;
- `expires_at > now`.

Only one concurrent refresh request can consume a token. A replay of the old
token returns `401 INVALID_REFRESH_TOKEN`.

## Protected request flow

```text
Client: Authorization: Bearer <access-token>
  -> authenticate middleware
  -> verify JWT signature, algorithm, and expiration
  -> attach { userId, email } to request.auth
  -> protected controller
  -> response
```

`GET /users/me` uses the authentication middleware context to load the
authenticated user's persisted public profile. Its profile update counterpart is
documented in `user-profile-architecture.md`.

## Error responses

| Situation                                                      | Status | Code                      |
| -------------------------------------------------------------- | -----: | ------------------------- |
| Invalid login body                                             |    400 | `INVALID_INPUT`           |
| Wrong email or password                                        |    401 | `INVALID_CREDENTIALS`     |
| Missing bearer token                                           |    401 | `AUTHENTICATION_REQUIRED` |
| Invalid or expired access token                                |    401 | `INVALID_ACCESS_TOKEN`    |
| Missing, invalid, expired, revoked, or replayed refresh cookie |    401 | `INVALID_REFRESH_TOKEN`   |
| Malformed JSON                                                 |    400 | `INVALID_JSON`            |
| Unexpected infrastructure error                                |    500 | `INTERNAL_SERVER_ERROR`   |

The login error intentionally does not disclose whether email or password was
incorrect.

## Persistence

Migration `0001_huge_hobgoblin.sql` adds `refresh_tokens`:

```text
id
user_id -> users.id (ON DELETE CASCADE)
token_hash UNIQUE
expires_at
revoked_at
created_at
```

Indexes on `user_id` and `expires_at` support token lookup/cleanup patterns.
The `token_hash` unique constraint prevents duplicate stored hashes.

## Module responsibilities

```text
src/modules/auth/
  auth.schema.ts       Request contracts for register/login.
  auth.controller.ts   HTTP handlers and refresh-cookie transport.
  refresh-token-cookie.ts Cookie parsing and secure cookie options.
  auth.service.ts      Password verification and token lifecycle rules.
  auth.repository.ts   User and refresh-token persistence/transaction.
  auth.token.ts        JWT signing/verification and refresh-token generation.
  auth.route.ts        /auth route declarations.

src/middleware/authenticate.ts
  Bearer-token extraction, verification, and request.auth context.

src/modules/users/
  Authenticated profile endpoints.
```

## Verification

```bash
docker compose up -d
npm run db:migrate
npm run db:migrate:test
npm test
```

The integration suite covers valid/invalid login, protected access, invalid and
expired access tokens, refresh-cookie rotation/replay protection, and logout
revocation/clearing.
