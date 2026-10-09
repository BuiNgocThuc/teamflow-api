# Bài 11: Authentication Flow và Code Review Guide

Tài liệu này mô tả luồng xác thực hiện tại của TeamFlow API và TeamFlow Web.
Mục tiêu là đọc source theo đúng thứ tự request đi qua hệ thống, hiểu vì sao mỗi
lớp tồn tại, và có checklist để review thủ công.

## 1. Kiến trúc session hiện tại

```text
Browser / TeamFlow Web
  |
  | access token: Authorization: Bearer <JWT>
  | refresh token: HttpOnly cookie tự gửi cho /auth/*
  v
TeamFlow API
  |
  v
PostgreSQL
  - users
  - refresh_tokens (chỉ lưu SHA-256 hash)
```

Hai token có trách nhiệm khác nhau:

| Token         | Nơi giữ                        | Mục đích                                      | Thời hạn mặc định |
| ------------- | ------------------------------ | --------------------------------------------- | ----------------- |
| Access token  | JavaScript memory của frontend | Gọi protected API qua bearer header           | 15 phút           |
| Refresh token | Browser `HttpOnly` cookie      | Lấy access token mới khi access token hết hạn | 7 ngày            |

Refresh token không được frontend đọc, lưu vào `localStorage`,
`sessionStorage`, hoặc nhận trong JSON body.

## 2. File map

### Backend

```text
src/
  server.ts                              Process entry point; loads .env and cleanup job.
  app.ts                                 Express middleware and route composition.
  middleware/
    cors.ts                              Exact-origin credentialed CORS policy.
    authenticate.ts                      Bearer JWT verification and request.auth context.
    error-handler.ts                     Maps errors to safe HTTP responses.
    rate-limit.ts                        Reusable in-memory fixed-window limiter.
  modules/auth/
    auth.route.ts                        /auth/register, /login, /refresh, /logout routes.
    auth.rate-limit.ts                   Login/register limiter configuration.
    auth.controller.ts                   HTTP request/response and cookie transport.
    auth.schema.ts                       Zod contracts for register and login bodies.
    auth.service.ts                      Password and token lifecycle rules.
    auth.repository.ts                   User and refresh-token persistence/transactions.
    auth.token.ts                        JWT signing/verifying and random token generation.
    refresh-token-cookie.ts              Cookie read/set/clear options.
    refresh-token-cleanup.ts             Periodic expired-token cleanup.
  database/schema.ts                     users and refresh_tokens schema.
  shared/errors/                         Stable public error codes and HTTP statuses.
```

### Frontend

```text
src/
  lib/api/
    client.ts                            Axios instance and request/response interceptors.
    session.ts                           In-memory access token and refresh single-flight.
    errors.ts                            API error-envelope parsing.
  features/auth/
    api.ts                               Auth/profile endpoint functions.
    auth-provider.tsx                   Auth state, bootstrap, login, logout.
    require-authentication.tsx          Protected UI route boundary.
  components/auth/auth-form.tsx         Login/register form.
```

## 3. Application bootstrap and CORS

```mermaid
sequenceDiagram
    participant Process as Node.js process
    participant Server as src/server.ts
    participant App as src/app.ts
    participant CORS as cors middleware

    Process->>Server: npm run dev / npm start
    Server->>Server: load dotenv/config
    Server->>App: import Express app
    App->>CORS: app.use(cors)
    App->>App: app.use(express.json())
    App->>App: mount /auth and protected routers
```

Read these files first:

1. `src/server.ts` loads environment variables before importing the app and
   starts refresh-token cleanup.
2. `src/app.ts` installs CORS before routes, JSON parsing, then the centralized
   error handler last.
3. `src/middleware/cors.ts` requires `FRONTEND_ORIGIN`, compares it exactly
   with the request `Origin`, and returns credentialed CORS headers only for
   that configured origin.

`FRONTEND_ORIGIN` must be an absolute origin without a path. For local
development it is `http://localhost:3001`; the API is normally
`http://localhost:3000`.

## 4. Registration flow

```mermaid
sequenceDiagram
    participant Browser
    participant Router as auth.route.ts
    participant Limit as authRateLimit
    participant Controller as auth.controller.ts
    participant Service as auth.service.ts
    participant Repository as auth.repository.ts
    participant DB as PostgreSQL

    Browser->>Router: POST /auth/register {name,email,password}
    Router->>Limit: apply IP-based rate limit
    Limit->>Controller: allowed request
    Controller->>Controller: registerSchema.parse(body)
    Controller->>Service: registerUser(input)
    Service->>Repository: findByEmail(normalized email)
    Service->>Service: argon2.hash(password, argon2id)
    Service->>Repository: create({name,email,passwordHash})
    Repository->>DB: INSERT users
    DB-->>Controller: public user fields
    Controller-->>Browser: 201 {user}
```

Manual-review questions:

- Does `registerSchema` trim and lowercase email?
- Is the password hash, not plaintext password, sent to the repository?
- Is a duplicate email handled both before insert and by PostgreSQL's unique
  constraint for concurrent requests?
- Does the response exclude `passwordHash`?

Relevant files:

```text
src/modules/auth/auth.schema.ts
src/modules/auth/auth.service.ts
src/modules/auth/auth.repository.ts
src/database/schema.ts
```

## 5. Login flow

```mermaid
sequenceDiagram
    participant Browser
    participant Router as auth.route.ts
    participant Controller as auth.controller.ts
    participant Service as auth.service.ts
    participant Token as auth.token.ts
    participant Repository as auth.repository.ts
    participant DB as PostgreSQL

    Browser->>Router: POST /auth/login {email,password}
    Router->>Controller: authenticated route handler
    Controller->>Service: loginUser(validated input)
    Service->>Repository: findByEmail(email)
    Repository->>DB: SELECT user
    Service->>Service: argon2.verify(passwordHash, password)
    Service->>Token: createAccessToken(user identity)
    Service->>Token: createRefreshToken()
    Token-->>Service: raw token + SHA-256 hash + expiry
    Service->>Repository: createRefreshToken(hash, expiry)
    Repository->>DB: INSERT refresh_tokens
    Service-->>Controller: accessToken + raw refresh token
    Controller->>Browser: Set-Cookie refresh token
    Controller-->>Browser: 200 {accessToken}
```

Review in this order:

1. `auth.schema.ts`: login input validation and email normalization.
2. `auth.service.ts`: generic `INVALID_CREDENTIALS` response, Argon2 verify,
   and separation of raw versus hashed refresh token.
3. `auth.token.ts`: JWT header is fixed to HS256; claims are user ID (`sub`)
   and email; access TTL is read from environment.
4. `auth.repository.ts`: only `tokenHash`, never raw token, reaches PostgreSQL.
5. `refresh-token-cookie.ts`: raw token is sent with `HttpOnly`, `SameSite=Lax`,
   `/auth` path, and `Secure` in production.

## 6. Protected request and RBAC flow

```mermaid
sequenceDiagram
    participant UI as Feature UI
    participant Axios as Axios request interceptor
    participant Middleware as authenticate.ts
    participant Controller
    participant Service
    participant RBAC as organizations.authorization.ts
    participant DB as PostgreSQL

    UI->>Axios: protected apiRequest(...)
    Axios->>Axios: add Authorization: Bearer accessToken
    Axios->>Middleware: HTTP request
    Middleware->>Middleware: verify JWT signature, algorithm, expiry
    Middleware->>Controller: request.auth = {userId,email}
    Controller->>Service: use authenticated userId
    Service->>RBAC: requireMembership / requireOwner / requireProjectManager
    RBAC->>DB: read organization membership
    alt authorized
        Service-->>UI: 2xx response
    else missing or invalid JWT
        Middleware-->>UI: 401
    else valid JWT but insufficient role
        RBAC-->>UI: 403
    end
```

Important distinction:

```text
401 = identity is missing, invalid, or expired.
403 = identity is valid but its organization role cannot perform the action.
```

Review files:

```text
teamflow-web/src/lib/api/client.ts
teamflow-web/src/lib/api/session.ts
teamflow-api/src/middleware/authenticate.ts
teamflow-api/src/shared/authenticated-user.ts
teamflow-api/src/modules/organizations/organizations.authorization.ts
```

## 7. Refresh, rotation, and retry flow

```mermaid
sequenceDiagram
    participant API as Protected API request
    participant Axios as response interceptor
    participant Session as session.ts
    participant Browser
    participant Controller as auth.controller.ts
    participant Repository as auth.repository.ts
    participant DB as PostgreSQL

    API-->>Axios: 401 response
    Axios->>Session: refreshAccessToken()
    Note over Session: Reuse refreshInFlight if one exists
    Session->>Browser: POST /auth/refresh
    Browser->>Controller: sends HttpOnly refresh cookie
    Controller->>Repository: rotateRefreshToken(current hash, next hash)
    Repository->>DB: BEGIN
    Repository->>DB: UPDATE active, unexpired token to revoked
    alt current token consumed successfully
        Repository->>DB: INSERT replacement hashed token
        Repository->>DB: COMMIT
        Controller-->>Browser: Set-Cookie replacement + {accessToken}
        Browser-->>Session: accessToken
        Session-->>Axios: new access token
        Axios->>API: retry original request once
    else missing, expired, revoked, or replayed token
        Repository->>DB: COMMIT without replacement
        Controller-->>Browser: 401 INVALID_REFRESH_TOKEN
        Session->>Session: clear local auth state
    end
```

There are three separate guards against unsafe retry behavior:

1. `client.ts` only considers `401`, never `403`, for refresh.
2. `_retry` allows an original request to be replayed at most once.
3. `skipAuthRefresh` and `/auth/*` exclusion prevent refresh endpoint failures
   from recursively refreshing themselves.

`session.ts` contains `refreshInFlight`. Several simultaneous expired requests
therefore await one refresh promise instead of consuming the same refresh token
multiple times.

Most important backend code to review:

```text
src/modules/auth/auth.repository.ts -> rotateRefreshToken()
src/modules/auth/auth.service.ts -> refreshAuthentication()
src/modules/auth/auth.controller.ts -> refresh()
```

The conditional `UPDATE` inside a database transaction closes the race between
"check whether token is active" and "revoke token". Only one concurrent request
can match `revoked_at IS NULL`.

## 8. Session restoration after reload

```text
Browser reload
  -> JavaScript memory is reset; access token is gone
  -> AuthProvider mounts with status = "loading"
  -> useEffect calls refreshSession()
  -> browser sends refresh cookie to POST /auth/refresh
  -> response returns a new access token
  -> AuthProvider calls GET /users/me
  -> status becomes "authenticated"

Refresh failure
  -> clearAccessToken()
  -> user = null
  -> status = "anonymous"
  -> RequireAuthentication redirects to /login
```

Review:

```text
teamflow-web/src/features/auth/auth-provider.tsx
teamflow-web/src/features/auth/require-authentication.tsx
teamflow-web/src/app/layout.tsx
```

## 9. Logout flow

```mermaid
sequenceDiagram
    participant UI as Profile/logout UI
    participant Provider as AuthProvider
    participant Browser
    participant Controller as auth.controller.ts
    participant Repository as auth.repository.ts
    participant DB as PostgreSQL

    UI->>Provider: logout()
    Provider->>Browser: POST /auth/logout
    Browser->>Controller: refresh cookie
    Controller->>Repository: revokeRefreshToken(SHA-256(cookie token))
    Repository->>DB: UPDATE active row SET revoked_at = now()
    Controller-->>Browser: clear refresh cookie + 204
    Provider->>Provider: clear access token and user state
    Provider-->>UI: anonymous state
```

The frontend clears local state in `finally`, so it becomes anonymous even if
the network request fails. The backend accepts logout without a cookie and still
clears the cookie, making logout idempotent from the browser's perspective.

Access JWTs are not blacklisted. A stolen or previously issued access JWT can
remain valid until its short expiration; logout prevents new access tokens from
being minted with the revoked refresh token.

## 10. Security checklist for manual review

### Confirmed by current code

- [x] Argon2id password hashing.
- [x] Generic invalid-credential error.
- [x] Refresh tokens are random opaque values and only their hashes persist.
- [x] Refresh rotation is transactional and conditional.
- [x] Replay of an old refresh token is rejected.
- [x] Refresh token is not included in JSON or frontend storage.
- [x] Access token is memory-only and bearer-authenticated.
- [x] JWT verifier restricts accepted algorithm to HS256.
- [x] CORS does not use `*` with credentials.
- [x] Backend performs RBAC checks; frontend visibility is not authorization.
- [x] Login/register have an in-memory rate limit.

### Items to assess before broader production deployment

- [ ] Add Origin/Referer validation to cookie-authenticated `/auth/refresh` and
      `/auth/logout` if sibling subdomains are not all trusted, or if moving to
      `SameSite=None`.
- [ ] Define refresh-token family/session reuse detection if an attacker wins a
      refresh-token race and a full-session revocation is required.
- [ ] Replace the per-process rate-limit `Map` with a shared store or edge
      limiter for multiple API instances.
- [ ] Decide whether immediate access-token revocation is required on logout.
- [ ] Add `Cache-Control: no-store` to responses containing access tokens.
- [ ] Add browser-level integration tests for CORS, cookie persistence, refresh
      retry, single-flight behavior, and logout.
- [ ] Test the production `Secure` cookie path explicitly.

## 11. Existing tests

```text
tests/integration/auth/authentication.test.ts
  - login does not return refreshToken JSON
  - HttpOnly/SameSite/path cookie attributes
  - valid/invalid/expired access token
  - refresh rotation and old-token replay rejection
  - JSON refresh-token input is rejected
  - logout revokes token and clears cookie

tests/integration/auth/refresh-token-cleanup.test.ts
  - expired token cleanup preserves active tokens

tests/unit/rate-limit.test.ts
  - 429 and Retry-After behavior

tests/integration/health.test.ts
  - configured credentialed CORS origin is allowed
  - other origin does not receive credentialed CORS headers
```

Useful commands when PostgreSQL is available:

```bash
cd teamflow-api
docker compose up -d
npm run db:migrate:test
npm run typecheck
npm test
```

For frontend static validation:

```bash
cd teamflow-web
npm run lint
```
