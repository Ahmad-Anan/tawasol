# API Reference — Route Posts API

Source of truth for confirmed request/response shapes of `https://route-posts.routemisr.com`. Entries are added here only after being verified via Postman — do not write a service against an endpoint that isn't documented here yet; test it in Postman first.

Standard response envelope, per AGENTS.md:

```json
// success
{ "success": true, "message": "string", "data": {}, "meta": {} }

// failure
{ "success": false, "message": "string", "errors": "string | string[]" }
```

`errors` has been observed as both a plain string and an array of strings depending on the endpoint — always type it `string | string[]` and handle both when reading it.

---

## POST /users/signup

Creates a new account.

**Request body**

```json
{
  "name": "string",
  "username": "string",
  "email": "string",
  "dateOfBirth": "string",
  "gender": "string",
  "password": "string",
  "rePassword": "string"
}
```

**Success response**

```json
{
  "success": true,
  "message": "account created",
  "data": {
    "token": "string",
    "tokenType": "Bearer",
    "expiresIn": "7d",
    "user": {
      "_id": "string",
      "name": "string",
      "username": "string",
      "email": "string",
      "photo": "string (full URL)",
      "cover": "string"
    }
  }
}
```

**Failure example**

```json
{
  "success": false,
  "message": "user already exists.",
  "errors": "user already exists."
}
```

---

## POST /users/signin

Authenticates an existing account.

**Request body**

```json
{
  "email": "string",
  "password": "string"
}
```

The backend also accepts `username` or `login` as the key in place of `email` — all three are acceptable identifiers for this request. Treat the field as "email, username, or login" on the client, not strictly an email address.

**Verified (live test, 2026-08-12):** the `login` key has no format restriction — it accepts either an email-shaped or a plain-username-shaped value (`200`, `signed in successfully` for both). `username` is validated server-side as `^[a-z0-9_]{3,30}$` and returns a `400` if the value doesn't match that (e.g. an email address, which contains `.`/`@`), even when a valid `email` is also present in the same body — the API validates every key it receives, not just the one it ends up using. **Send only `login`** (never `email`+`username`+`login` together) when the client doesn't know in advance whether the user typed an email or a username.

**Success response**

Same `data` shape as `/users/signup`'s success response (`token`, `tokenType`, `expiresIn`, `user`).

**Failure example**

```json
{
  "success": false,
  "message": "incorrect email or password",
  "errors": "incorrect email or password"
}
```
