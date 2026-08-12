# 프로젝트 구성 및 기능 계획

## 프로젝트 개요

이 프로젝트는 독서 기록장을 만들고 관리하는 Next.js 기반 웹 애플리케이션입니다. 사용자는 책별로 독서 기록을 추가하고, 날짜별 기록, 읽은 페이지, 최종 요약, 최종 감상, 마음에 드는 장면과 이미지를 정리할 수 있습니다.

현재 앱은 Next.js App Router 구조를 사용하며, Supabase를 인증과 데이터베이스 기반으로 사용하도록 구성되어 있습니다.

## 기술 스택

- Next.js 15
- React 19
- TypeScript
- Supabase Auth
- Supabase Database
- Supabase SSR
- Vercel 배포 예정

## 주요 디렉터리 구조

```text
.
├── app/
│   ├── auth/callback/route.ts
│   ├── admin/page.tsx
│   ├── library/page.tsx
│   ├── main/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── auth-actions.tsx
│   ├── account-profile.tsx
│   ├── delete-entry-button.tsx
│   ├── library-content.tsx
│   ├── login-button.tsx
│   ├── logout-button.tsx
│   ├── main-content.tsx
│   ├── reading-entry-form.tsx
│   └── site-logo.tsx
├── lib/
│   ├── admin.ts
│   └── supabase/
│       ├── browser.ts
│       └── server.ts
├── supabase/
│   └── schema.sql
├── middleware.ts
├── next.config.ts
├── package.json
└── README.md
```

## 현재 화면 구성

### `/`

루트 페이지입니다. `MainContent` 컴포넌트를 렌더링합니다.

### `/main`

메인 페이지입니다. 루트 페이지와 동일하게 `MainContent`를 사용합니다. 로그인 상태에 따라 상단에 계정 프로필 또는 로그인 버튼을 보여주고, 공개된 독서 기록장을 찾기 위한 검색창을 제공합니다.

### `/admin`

관리자 페이지입니다. `ADMIN_EMAILS`에 등록된 관리자 계정만 접근할 수 있으며, 계정 프로필에서 이동합니다. 공개 책 관리, 검색 관리, 사용자 기록 관리 기능을 이 페이지에서 확장할 예정입니다.

### `/library`

독서 기록장 페이지입니다. 서버에서 Supabase 유저 정보를 가져오고, 로그인 여부와 관리자 여부에 따라 상단 UI를 다르게 보여줍니다. 실제 독서 기록장 인터페이스는 `LibraryContent` 컴포넌트가 담당합니다.

### `/auth/callback`

Supabase 인증 콜백 라우트입니다. OAuth 또는 이메일 인증 이후 전달된 코드를 Supabase 세션으로 교환하고, `next` 파라미터에 지정된 페이지로 이동시킵니다.

## 현재 주요 컴포넌트

### `MainContent`

메인 화면 레이아웃을 담당합니다.

- Supabase 서버 클라이언트로 현재 유저 확인
- 로그인 상태면 계정 프로필 표시
- 비로그인 상태면 로그인 모달 진입 버튼 표시
- 메인 페이지는 로고와 계정 프로필 중심의 빈 화면으로 유지

### `AccountProfile`

로그인 상태의 계정 프로필 UI를 담당합니다.

- 계정 프로필 버튼 표시
- 프로필 화면에서 서재로 이동
- 관리자 계정이면 프로필 화면에서 관리자 페이지로 이동
- 프로필 화면에서 로그아웃
- 모든 페이지에서 동일한 계정 프로필 화면 사용

### `LibraryContent`

독서 기록장 핵심 UI입니다. 현재는 클라이언트 상태로 독서 기록을 관리합니다.

지원하는 기능:

- 책 기록 추가
- 책 제목 입력
- 전체 페이지 수 입력
- 날짜별 독서 기록 추가
- 날짜, 읽은 페이지, 메모 입력
- 읽은 페이지 기준 진행률 표시
- 최종 요약 입력
- 최종 감상 입력
- 좋아하는 장면 입력
- 좋아하는 장면 이미지 업로드 및 미리보기
- 선택한 기록 삭제
- 변경 사항 확인 및 취소

### `AuthActions`

비로그인 상태에서 프로필 버튼을 누르면 로그인 모달을 엽니다.

### `LoginButton`

로그인과 회원가입 UI를 담당합니다.

지원하는 인증 방식:

- 이메일/비밀번호 로그인
- 이메일/비밀번호 회원가입
- Kakao OAuth 로그인

### `LogoutButton`

Supabase 세션을 로그아웃하고 루트 페이지로 이동합니다.

### `SiteLogo`

사이트 로고 표시를 담당합니다.

## Supabase 구성

### 클라이언트

- `lib/supabase/browser.ts`: 브라우저에서 사용하는 Supabase 클라이언트
- `lib/supabase/server.ts`: 서버 컴포넌트와 라우트에서 사용하는 Supabase SSR 클라이언트

### 데이터베이스

`supabase/schema.sql`에는 기존 `reading_entries` 테이블과 최종 책장 UI용 `reading_logs`, `reading_log_entries` 테이블이 정의되어 있습니다.

`reading_logs` 주요 컬럼:

- `id`
- `user_id`
- `title`
- `total_pages`
- `final_summary`
- `final_review`
- `favorite_scene`
- `favorite_scene_image`
- `created_at`
- `updated_at`

`reading_log_entries` 주요 컬럼:

- `id`
- `reading_log_id`
- `entry_date`
- `note`
- `current_page`
- `position`
- `created_at`
- `updated_at`

RLS 정책도 함께 정의되어 있어, 사용자는 자신의 독서 기록만 조회, 생성, 수정, 삭제할 수 있도록 설계되어 있습니다.

## 현재 상태에서 확인할 점

- `LibraryContent`의 독서 기록 데이터는 확인/삭제 시 Supabase의 `reading_logs`, `reading_log_entries`에 저장됩니다.
- 기존 `reading_entries` 샘플 데이터는 SQL 마이그레이션으로 새 구조에 복사됩니다.
- 일부 기존 문서와 UI 문자열은 인코딩이 깨져 보이므로 UTF-8 기준으로 정리할 필요가 있습니다.
- `/library`는 로그인 사용자만 접근하고, 세션이 없으면 `/main`으로 이동합니다.

## 앞으로 추가할 기능

## 1. 독서 기록장 공유하기

목표는 사용자가 작성한 책 독서 기록장을 메인 페이지 검색 결과에 공개할지 말지 정할 수 있게 만드는 것입니다.

예상 기능:

- 책별 검색 노출 여부 설정
- 공개로 설정한 책은 메인 페이지 검색 결과에 표시
- 비공개로 설정한 책은 작성자의 서재에서만 표시
- 검색 결과에서는 책 제목, 작성자, 진행률, 최종 요약 또는 일부 독서 기록 표시
- 검색 결과에서 책을 선택하면 읽기 전용 상세 화면 표시

개발 시 고려할 점:

- 공유 대상은 사용자의 전체 서재가 아니라 `책 한 권의 독서 기록장` 기준
- `is_public` 또는 `is_searchable` 같은 공개 여부 컬럼 필요
- 독서 상태는 가장 최근 읽은 쪽수와 전체 쪽수를 기준으로 `읽는 중` 또는 `완독`으로 계산
- 메인 페이지 검색은 공개된 책만 조회해야 함
- 작성자 본인은 공개 여부와 상관없이 자신의 서재에서 모든 책을 볼 수 있어야 함
- RLS 정책에서 공개 책 조회 조건과 본인 책 조회 조건을 함께 고려해야 함

## 2. 독서 기록장 검색

목표는 메인 페이지에서 공개된 독서 기록장을 검색하고, 서재 안에서는 사용자가 자신의 독서 기록을 빠르게 찾을 수 있게 만드는 것입니다.

예상 기능:

- 책 제목 검색
- 독서 메모 내용 검색
- 최종 요약 및 최종 감상 검색
- 상태별 필터
- 읽는 중, 완독, 잠시 멈춤 같은 상태 필터
- 메인 페이지에서는 공개된 책만 검색 결과에 표시
- 서재 페이지에서는 내 책 전체를 검색
- 검색어가 없을 때 공개 책 또는 내 책 목록 표시
- 계정 프로필 유지
- 계정 프로필을 클릭해 서재로 이동

개발 시 고려할 점:

- 클라이언트 상태 검색과 Supabase 쿼리 검색 중 선택 필요
- 데이터가 Supabase에 저장되면 서버 쿼리 기반 검색이 적합
- 제목, 메모, 감상 텍스트에 대한 검색 인덱스 고려
- 메인 페이지 검색과 서재 내부 검색의 조회 조건을 분리해야 함

## 3. 로그인

목표는 독서 기록을 사용자 계정과 연결하고, 개인별 기록을 안전하게 저장하는 것입니다.

현재 구현된 부분:

- 이메일/비밀번호 로그인
- 이메일/비밀번호 회원가입
- Kakao OAuth 로그인
- 로그아웃
- Supabase 세션 확인
- 인증 콜백 라우트

추가하면 좋은 작업:

- 회원가입 후 이메일 인증 흐름 안내 개선
- 로그인 실패 메시지 한국어 정리
- 로그인 후 이동 경로 통일
- 관리자 뱃지와 관리자 권한의 실제 사용 범위 정의

## 4. 관리자 기능

목표는 관리자 계정이 별도 관리자 페이지에서 공개 책, 검색 노출, 사용자 기록 상태를 관리할 수 있게 만드는 것입니다.

현재 구현된 부분:

- `ADMIN_EMAILS` 기반 관리자 판별
- `/admin` 관리자 페이지 추가
- 관리자 계정이면 계정 프로필에 관리자 페이지 이동 버튼 표시

추가하면 좋은 작업:

- 공개 책 목록 조회
- 비공개 전환 또는 검색 노출 해제 기능
- 사용자별 독서 기록 조회 정책 정리
- 검색 결과 관리 기능
- 관리자 페이지 접근 로그 또는 최소한의 점검 UI

## 개발 체크리스트

개발 중 기능 범위와 화면 흐름은 변경될 수 있습니다. 아래 체크리스트는 현재 기준의 작업 목록이며, 구현 과정에서 세부 항목을 추가하거나 우선순위를 조정합니다.

### 책 공유

- [x] 책 단위로 메인 검색 노출 여부를 설정하도록 범위 확정
- [x] 공개 여부 컬럼 이름 결정: `is_public`
- [x] 책 작성 화면에 공개 여부 토글 추가
- [x] 공개된 책만 메인 페이지 검색 결과에 표시
- [x] 비공개 책은 작성자 서재에서만 표시
- [x] 검색 결과에서 책을 선택했을 때 읽기 전용 상세 화면 표시
- [x] 공개 상세 화면에 책 제목, 진행률, 단락별 기록, 최종 요약, 최종 감상 표시
- [x] Supabase RLS 정책에 공개 책 조회 조건 추가
- [x] 작성자 본인은 공개 여부와 상관없이 자신의 책을 조회할 수 있도록 정책 검토
- [x] 공개 여부 변경 후 메인 검색 결과 반영 확인
- [ ] 모바일에서 공개 토글과 검색 결과 화면 확인

### 책 검색

- [x] 메인 페이지 검색은 공개된 책만 대상으로 제한
- [x] 서재 페이지 검색은 내 책 전체를 대상으로 제한
- [x] 메인 페이지 상단 바에 검색창 추가
- [x] 책 제목 검색 추가
- [x] 검색어가 없을 때 전체 책 목록 표시
- [x] 검색 결과가 없을 때 빈 상태 UI 추가
- [x] 검색 입력창 위치 결정
- [x] 상태별 필터 추가: 읽는 중, 완독
- [x] Supabase 저장 구조 확정 후 데이터베이스 쿼리 기반 검색으로 전환
- [x] 검색 성능을 위해 trigram 인덱스 추가

### 독서 기록장 작성 경험 개선

- [x] 단락별 삭제 버튼 추가
- [x] 단락 삭제 전 확인 흐름 검토
- [x] 단락 삭제 후 남은 단락의 페이지 순서 검증
- [x] 단락 내용 수정 기능 정리
- [x] 단락 날짜 수정 기능 유지
- [x] 단락의 현재 읽은 페이지 수정 기능 유지
- [x] 수정 중인 단락과 저장된 단락의 상태 구분
- [x] 최종 영역에 내용이 있으면 내용 간단 요약과 최종 감상평을 모두 입력해야 확인 가능
- [x] 변경 사항 확인과 취소 동작 정리
- [x] 새 단락 추가 후 바로 작성할 수 있도록 포커스 처리 검토

### 책 단위 편집 UI 개선

- [x] 현재 삭제 버튼을 책 제목 옆으로 이동
- [x] 책 제목 입력 영역과 삭제 버튼이 모바일에서 겹치지 않도록 스타일 조정
- [x] 책 삭제 버튼의 위험 동작 스타일 정리
- [x] 책 삭제 전 확인 흐름 검토
- [x] 책 제목, 전체 페이지 수, 최종 기록 영역의 편집 흐름 정리

### 로그인과 개인 데이터 연결

- [x] 로그인하지 않은 사용자의 `/library` 접근 정책 결정
- [x] 로그인 후 사용자별 독서 기록 불러오기
- [x] 현재 `reading_entries` 임시 조회를 최종 데이터 모델로 전환
- [x] `reading_logs` 테이블 생성
- [x] `reading_log_entries` 테이블 생성
- [x] 기존 `reading_entries` 샘플 데이터를 새 구조로 마이그레이션
- [x] 책 한 권 아래 여러 날짜별 단락 기록이 저장되도록 Supabase 연결
- [x] 책 생성, 수정, 삭제를 Supabase에 저장
- [x] 단락 생성, 수정, 삭제를 Supabase에 저장
- [x] 로그인 상태의 계정 프로필 UI 유지
- [x] 모든 페이지에서 동일한 계정 프로필 화면 유지
- [x] 모바일 계정 프로필 버튼 글씨와 터치 영역 확대
- [x] 세션 만료 시 처리 방식 결정

### 관리자 기능

- [x] 관리자 페이지 라우트 추가
- [x] 계정 프로필에서 관리자 페이지로 이동
- [x] 관리자 계정만 관리자 페이지 접근
- [ ] 공개 책 목록 관리 기능 추가
- [ ] 검색 노출 상태 관리 기능 추가
- [ ] 사용자 기록 관리 범위 결정
- [ ] 관리자 페이지에서 실제 Supabase 데이터 조회 연결

### 개발 기록 관리

- [ ] 큰 기능을 구현할 때마다 이 체크리스트 갱신
- [ ] 완료한 항목은 체크 처리
- [ ] 구현 중 바뀐 정책이나 데이터 구조를 문서에 반영
- [ ] 기능별 남은 이슈와 다음 작업을 간단히 기록

## 추천 개발 순서

1. 깨진 한글 문자열과 README 인코딩 정리
2. 현재 `LibraryContent` 데이터 모델을 Supabase 테이블 구조와 맞추기
3. 로그인 사용자별 독서 기록 저장 기능 연결
4. `/library` 페이지 접근 정책 정리
5. 독서 기록장 검색 기능 추가
6. 책 공개 여부 설정과 메인 검색 노출 기능 추가
7. 배포 환경 변수와 Supabase Redirect URL 점검

## 데이터 모델 개선 제안

현재 UI는 책 한 권 아래에 여러 날짜별 기록이 들어가는 구조입니다. Supabase 테이블도 이에 맞춰 분리하는 편이 좋습니다.

예상 테이블:

- `reading_logs`: 책 단위 기록
- `reading_log_entries`: 날짜별 독서 기록
- 공개 설정은 `reading_logs`에 `is_public` 또는 `is_searchable` 컬럼으로 추가

예시 구조:

```text
reading_logs
- id
- user_id
- title
- total_pages
- final_summary
- final_review
- favorite_scene
- favorite_scene_image_url
- is_public
- created_at
- updated_at

reading_log_entries
- id
- reading_log_id
- date
- note
- current_page
- created_at
- updated_at
```

### Recent Progress

- [x] Keep the main-page search query in the input after submitting
- [x] Add reading-log visibility controls and a public search page
- [x] Search public and private logs by title, reading notes, summary, review, and favorite scene
- [x] Add status filters and a read-only public log detail view

이렇게 나누면 메인 검색 노출, 서재 내부 검색, 사용자별 저장을 확장하기 쉬워집니다.
