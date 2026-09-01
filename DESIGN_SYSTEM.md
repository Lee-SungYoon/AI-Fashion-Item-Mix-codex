# AI Fashion / Item Mix Design System

이 문서는 현재 앱 구조와 화면 디자인을 유지하면서 일관된 UI를 확장하기 위한 디자인 시스템 기준입니다. 앱의 성격은 고급 패션 에디토리얼 이미지 생성 도구이며, 전체 톤은 블랙 기반의 프로덕션 스튜디오 인터페이스입니다.

## 1. Design Principle

- 현재 앱은 랜딩 페이지가 아니라 실제 작업 도구가 첫 화면에 바로 노출되는 구조를 유지한다.
- 시각적 우선순위는 `업로드 -> 분석 -> 생성 결과 -> 프롬프트 변환` 흐름이 자연스럽게 읽히도록 구성한다.
- 장식적 요소보다 작업 상태, 이미지 프리뷰, 분석 결과, 프롬프트 복사 기능을 우선한다.
- 패션 에디토리얼 작업 도구답게 차분한 다크 톤, 얇은 보더, 작은 라벨, 명확한 CTA를 사용한다.
- 새 기능을 추가할 때는 기존 번호형 섹션 구조를 유지한다.

## 2. Color Tokens

| Role | Value | Usage |
|---|---:|---|
| Page Background | `#000000` / `bg-black` | 전체 앱 배경 |
| Panel Surface | `#050505` | 업로드 그룹, 체크리스트 카드 |
| Prompt Surface | `#020617` | Midjourney, Kling 프롬프트 출력 카드 |
| Soft Surface | `rgba(255,255,255,0.02)` / `bg-white/[0.02]` | 입력 박스, 결과 플레이스홀더 |
| Hover Surface | `rgba(255,255,255,0.04~0.06)` | 버튼/업로드 영역 hover |
| Primary | `#4F46E5` / `indigo-500~600` | 활성 상태, 강조, 로딩 스피너 |
| Primary Soft | `rgba(79,70,229,0.10)` | 선택된 세그먼트, 드래그 상태 |
| Primary Border | `rgba(129,140,248,0.5)` | 활성 버튼/업로드 완료 보더 |
| Text Strong | `#FFFFFF` | 주요 제목 |
| Text Default | `gray-300` | 본문, 버튼 라벨 |
| Text Muted | `gray-500~700` | 설명, 비활성, 플레이스홀더 |
| Error | `red-600` / `red-500` | 에러 토스트, 삭제 hover |

## 3. Typography

- 기본 폰트는 `Inter`, fallback은 `ui-sans-serif`, `system-ui`, `sans-serif`를 사용한다.
- 앱 타이틀은 `text-4xl font-bold tracking-tight` 기준으로 사용한다.
- 섹션 제목은 `text-xl font-bold text-white`를 기준으로 한다.
- 카드 내부 라벨은 `text-[12px]~text-[13px] font-bold text-gray-300`을 사용한다.
- 보조 정보와 상태 카운터는 `text-[10px] text-gray-600`을 사용한다.
- 프롬프트 출력 영역은 `font-mono text-[12px] leading-relaxed`를 사용해 복사 가능한 텍스트임을 명확히 한다.
- 전체적으로 negative letter spacing은 사용하지 않고, 작은 uppercase 라벨에만 제한적으로 `tracking-wider`를 사용한다.

## 4. Layout

- 전체 컨테이너는 `max-w-[1920px]`와 반응형 padding `p-6 md:p-8 lg:p-12`를 사용한다.
- 메인 작업 영역은 데스크톱에서 `lg:grid-cols-12`를 사용하고 좌우 패널을 각각 `lg:col-span-6`으로 나눈다.
- 모바일에서는 모든 섹션이 단일 컬럼으로 쌓인다.
- 좌측 패널은 입력과 분석 중심, 우측 패널은 결과와 프롬프트 중심으로 유지한다.
- 주요 섹션 간 간격은 `space-y-8` 또는 `gap-8~12`를 사용한다.
- 이미지 결과 영역은 `aspect-[3/4]`를 유지한다.
- 업로드 슬롯은 정사각형 `aspect-square`를 유지한다.

## 5. Radius & Border

- 앱의 기본 카드 반경은 현재 구현 기준 `rounded-xl` 또는 `rounded-2xl`을 사용한다.
- 작은 버튼, 세그먼트, 칩은 `rounded-lg`를 사용한다.
- 이미지 업로드와 결과 프레임은 `border-2 border-dashed border-white/10`을 기본으로 한다.
- 일반 카드 보더는 `border border-white/5`를 사용해 배경과 과하게 분리되지 않게 한다.
- 활성 상태는 `border-indigo-400/50` 또는 `border-indigo-500/50`을 사용한다.

## 6. Components

### Header

- 앱 이름 `AI Fashion / Item Mix`와 `PRO` 배지를 함께 표시한다.
- 배지는 `bg-[#4F46E5]`, `rounded-md`, 작은 bold 텍스트를 사용한다.
- 보조 설명은 `text-sm font-medium text-gray-500`으로 낮은 대비를 유지한다.
- `Reset Session`은 보조 액션이므로 작은 텍스트 버튼으로 유지한다.

### Section Title

- 모든 주요 작업 단계는 번호형 제목을 사용한다.
- 현재 구조:
  - `1. 레퍼런스 이미지`
  - `2. 의류 아이템`
  - `3. 추가 프롬프트`
  - `4. 생성 결과`
  - `5. AI Generated Midjourney`
  - `6. Kling Prompt`

### Image Upload Slot

- 기본 상태: `border-white/10 bg-white/[0.02]`
- hover 상태: `hover:border-indigo-500/30 hover:bg-white/[0.04]`
- drag 상태: `scale-[1.02] border-indigo-400 bg-indigo-500/10`
- 업로드 완료: `border-indigo-500/50 bg-[#050505]`
- 업로드 아이콘은 원형 `bg-white/5` 배경을 사용하고 hover 시 indigo tint를 적용한다.
- 삭제 버튼은 우상단에 배치하고 `hover:bg-red-600`으로 위험 액션을 명확히 한다.
- 분석 중에는 `bg-black/80 backdrop-blur-sm` 오버레이와 indigo spinner를 사용한다.

### Option Cards

- References 병합 강도와 스타일 프리셋은 작은 카드 안에 배치한다.
- 선택형 버튼은 3분할 또는 wrap 가능한 세그먼트로 표현한다.
- 선택됨: `bg-indigo-500 text-white`
- 비선택: `bg-white/[0.04] text-gray-500 hover:text-gray-200`

### Textarea

- `rounded-2xl border border-white/10 bg-white/[0.02] p-5`
- focus 상태는 `focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20`
- placeholder는 `text-gray-700`로 낮은 대비를 사용한다.

### Generate Button

- 기본 CTA는 전체 너비 버튼으로 유지한다.
- 색상은 차분한 `bg-[#242b35]`, hover는 `#303846`을 사용한다.
- 생성 중 또는 분석 중에는 `disabled:opacity-50`, `disabled:cursor-not-allowed`를 적용한다.
- 생성 버튼 문구는 현재 한국어 흐름에 맞춰 `2K 이미지 생성`을 유지한다.

### Result Frame

- 결과 이미지는 `object-contain`을 사용해 잘리지 않게 표시한다.
- hover 시 다운로드/확대 아이콘 버튼을 우상단에 표시한다.
- 확대 모달은 `bg-black/95 backdrop-blur-2xl`을 사용한다.

### Prompt Output Cards

- Midjourney와 Kling Prompt 카드는 같은 구조를 사용한다.
- 출력 surface는 `bg-[#020617]`, border는 `border-indigo-500/10`을 사용한다.
- 복사 버튼은 우측 상단에 고정된 `w-[110px] h-full` 형태로 유지한다.
- 출력 텍스트는 `pre`, `font-mono`, `whitespace-pre-wrap`을 사용한다.
- 로딩 문구는 어떤 이미지를 분석하는지 명확히 표시한다.

## 7. Interaction States

| State | Visual Rule |
|---|---|
| Default | 낮은 대비 surface와 얇은 white border |
| Hover | surface 밝기 소폭 상승, 텍스트 `gray-200` |
| Active | `active:scale-[0.98]` 또는 작은 버튼은 `active:scale-95` |
| Selected | indigo background 또는 indigo border |
| Loading | spinner + overlay + pulse text |
| Error | 하단 중앙 toast, red surface, 5초 후 자동 해제 |
| Disabled | opacity 50%, muted text, cursor not allowed |

## 8. Motion

- 인터랙션 전환은 기본적으로 `transition-all` 또는 `transition-colors`를 사용한다.
- 버튼 클릭은 미세한 scale down을 사용해 피드백을 준다.
- 로딩은 indigo spinner와 pulse text를 사용한다.
- 과한 애니메이션이나 배경 장식은 추가하지 않는다.

## 9. Content Tone

- UI 문구는 작업자 중심으로 짧고 명확하게 작성한다.
- 핵심 기능은 한국어로 표시하되, 모델/도구 이름은 영문을 유지한다.
- 예: `2K 이미지 생성`, `프롬프트 생성하기`, `Copy Prompt`, `Download PNG`
- 안내 문구는 기능 설명보다 현재 상태를 알려주는 데 집중한다.

## 10. Accessibility & Usability

- 버튼에는 가능한 `title` 또는 명확한 텍스트 라벨을 제공한다.
- 이미지 업로드 input은 `accept="image/png,image/jpeg,image/webp"`로 제한한다.
- 업로드 슬롯과 결과 프레임은 고정 비율을 유지해 레이아웃 흔들림을 줄인다.
- 텍스트가 긴 프롬프트 영역은 `whitespace-pre-wrap`으로 줄바꿈을 허용한다.
- 모바일에서 버튼/칩은 wrap 가능하게 구성한다.

## 11. Extension Rules

새 기능을 추가할 때는 다음 규칙을 따른다.

- 기존 번호 섹션 다음 번호로 추가한다.
- 기존 카드/버튼/프롬프트 출력 패턴을 재사용한다.
- 새로운 색상 팔레트를 만들지 않는다.
- 작업 흐름이 바뀌지 않게 좌측은 입력, 우측은 결과/프롬프트 중심으로 유지한다.
- 새로운 AI 프롬프트 생성 기능은 `4. 생성 결과` 이미지를 기준으로 분석한다는 문구를 명확히 포함한다.
- API 키나 로컬 비밀값은 UI, README, GitHub 커밋에 노출하지 않는다.

## 12. Current Design Tokens Summary

```ts
const designTokens = {
  font: 'Inter',
  pageBackground: '#000000',
  panelBackground: '#050505',
  promptBackground: '#020617',
  primary: '#4F46E5',
  actionBackground: '#242b35',
  actionHover: '#303846',
  borderSubtle: 'rgba(255,255,255,0.05)',
  borderDefault: 'rgba(255,255,255,0.10)',
  textStrong: '#ffffff',
  textDefault: 'rgb(209 213 219)',
  textMuted: 'rgb(107 114 128)',
  radiusSmall: '8px',
  radiusMedium: '12px',
  radiusLarge: '16px',
  maxWidth: '1920px',
  resultAspectRatio: '3 / 4',
  uploadAspectRatio: '1 / 1',
};
```
