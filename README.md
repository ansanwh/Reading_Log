# Reading Log

나만의 독서기록장 웹사이트 기본 틀입니다.

## Stack

- Next.js App Router
- Supabase Auth, Database
- Kakao login through Supabase OAuth
- Vercel deployment

## Local Setup

1. 의존성을 설치합니다.

```bash
npm install
```

2. `.env.example`을 참고해 `.env.local`을 만듭니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SECRET_KEY=sb_secret_... # 서버에서만 사용, 관리자 기능 및 코드 로그인에 필요
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_EMAILS=admin@example.com
```

3. Supabase SQL editor에서 `supabase/schema.sql`을 실행합니다.

4. Supabase Dashboard에서 Authentication Providers의 Kakao를 켭니다.

5. 실행합니다.

```bash
npm run dev
```

## Kakao OAuth Redirect URLs

Supabase Auth URL Configuration에 아래 주소를 추가합니다.

- Local: `http://localhost:3000/auth/callback`
- Vercel: `https://your-domain.vercel.app/auth/callback`

Kakao Developers의 Redirect URI에는 Supabase가 제공하는 OAuth callback URL을 등록해야 합니다.
Supabase Dashboard의 Kakao provider 설정 화면에서 확인할 수 있습니다.

## Vercel Environment Variables

Vercel Project Settings > Environment Variables에 아래 값을 넣습니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app`
