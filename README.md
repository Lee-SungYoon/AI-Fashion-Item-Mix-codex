# AI Fashion / Item Mix

얼굴/헤어, 포즈, 의류 아이템 이미지를 조합해 고품질 패션 에디토리얼 이미지를 생성하는 React 기반 AI 스타일링 도구입니다. Gemini 이미지 모델을 사용해 각 레퍼런스 이미지를 분석하고, 사용자가 입력한 분위기나 배경 프롬프트를 반영해 3:4 비율의 2K 패션 이미지를 합성합니다.

## 주요 기능

- 얼굴/헤어 레퍼런스와 포즈 레퍼런스 분리 업로드
- 아우터, 상의, 하의, 신발, 액세서리 이미지 업로드
- 업로드 이미지별 Gemini 기반 상세 패션 분석
- 추가 프롬프트를 반영한 패션 에디토리얼 이미지 생성
- 생성 결과 PNG 다운로드
- 생성 이미지 기반 Midjourney V7 프롬프트 생성 및 복사

## 기술 스택

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Google Gemini API (`@google/genai`)

## 시작하기

```bash
npm install
cp .env.example .env
npm run dev
```

`.env` 파일에 Gemini API 키를 입력합니다.

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

개발 서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

## 빌드

```bash
npm run build
```

## 타입 검사

```bash
npm run lint
```
