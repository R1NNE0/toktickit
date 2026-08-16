# Lab 1 — Test Plan and Evidence

All test files live under `server/tests/lab-01/` and `client/tests/lab-01/`.

| # | Tool | Test | Result |
|:---:|:---:|---|:---:|
| 1 | Supertest | GET /api/health returns 200, status=ok | Passed |
| 2 | Supertest | GET /api/categories returns 4 seeded categories in id order | Passed |
| 3 | Vitest | Heading renders | Passed |
| 4 | Vitest | Success state shows Online + category list | Passed |
| 5 | Vitest | Error state shows Offline + message | Passed |

---

## Server Tests

```bash
> toktickit-server@1.0.0 test
> vitest run


 RUN  v2.1.9 C:/Users/Songwit Rueangsawat/Desktop/SOFTWARE ENGINEERING/LAB1/toktickit/server

 ✓ tests/lab-01/categories.test.ts (1)
 ✓ tests/lab-01/health.test.ts (1)

 Test Files  2 passed (2)
      Tests  2 passed (2)
   Start at  03:27:40
   Duration  3.10s (transform 81ms, setup 0ms, collect 4.23s, tests 301ms, environment 0ms, prepare 814ms)
```

---

## Client Tests

```bash
> toktickit-client@1.0.0 test
> vitest run


 RUN  v2.1.9 C:/Users/Songwit Rueangsawat/Desktop/SOFTWARE ENGINEERING/LAB1/toktickit/client

 ✓ tests/lab-01/App.test.tsx (3)
   ✓ App (3)
     ✓ renders the TokTickIT heading
     ✓ shows Online and the seeded categories on success
     ✓ shows an Offline error message when the API is unavailable

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  03:29:49
   Duration  9.67s (transform 120ms, setup 1.08s, collect 1.85s, tests 176ms, environment 6.01s, prepare 304ms)
```