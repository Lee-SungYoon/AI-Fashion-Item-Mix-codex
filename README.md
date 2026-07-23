# AI Fashion / Item Mix

얼굴/헤어, 포즈, 의류 아이템 이미지를 조합해 고품질 패션 에디토리얼 이미지를 생성하는 React 기반 AI 스타일링 도구입니다. 업로드된 References 이미지는 얼굴/헤어와 포즈 일관성을 유지하는 기준으로 분석하고, Clothing Items 이미지는 소재, 색상, 실루엣, 디테일을 정밀 분석한 뒤 하나의 3:4 비율 2K 패션 이미지로 합성합니다.

## 주요 기능

- 얼굴/헤어 레퍼런스와 포즈 레퍼런스 분리 업로드
- 아우터, 상의, 하의, 신발, 액세서리 이미지 업로드
- 업로드 이미지별 Gemini 기반 상세 패션 분석
- 추가 프롬프트를 반영한 패션 에디토리얼 이미지 생성
- 생성 결과 PNG 다운로드
- 생성 이미지 기반 Midjourney 최신 버전 최적화 프롬프트 생성 및 복사
- References 병합 강도, 스타일 프리셋, Midjourney 프롬프트 출력 모드 선택
- 업로드 이미지 분석 결과 펼쳐보기와 생성 전 체크리스트
- 최근 생성 결과와 프롬프트 세션 히스토리
- 업로드 이미지 자동 리사이즈로 요청 안정성 개선
- 서버 프록시 기반 API 호출로 브라우저 번들 내 API 키 노출 방지
- PNG, JPG, WEBP 업로드 타입 및 20MB 크기 제한

## 기술 스택

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Google Gemini API (`@google/genai`)

## 시작하기

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` 파일에 Gemini API 키를 입력합니다. `.env.local`은 Git에 커밋되지 않습니다.

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

개발 서버는 기본적으로 `http://localhost:3004`에서 실행됩니다. 프론트엔드와 API 프록시가 같은 서버에서 동작하므로 API 키는 서버 환경 변수로만 사용됩니다.

## 빌드

```bash
npm run build
```

## 프로덕션 미리보기

```bash
npm run preview
```

## 타입 검사

```bash
npm run lint
```
