# Spine Portfolio

GitHub Pages용 정적 Spine 포트폴리오입니다.

## 가장 쉬운 수정 방법

1. `edit-portfolio.bat`를 더블클릭합니다.
2. 열린 관리자 화면에서 `Choose data file`을 누릅니다.
3. `data/portfolio.json`을 선택합니다.
4. 제목, 카테고리, 작품 이름, 설명, 순서를 수정합니다.
5. `Save local file`을 누릅니다.
6. 브라우저와 서버 창을 닫습니다.
7. `publish-portfolio.bat`를 더블클릭합니다.

`publish-portfolio.bat`가 `data/portfolio.json` 변경분을 커밋하고 GitHub로 push합니다.
GitHub Pages에는 push 후 잠시 뒤 자동 반영됩니다.

## 수정할 수 있는 내용

- 사이트 제목, 부제목, 설명
- 처음 열 작품
- 카테고리 추가, 삭제, 숨김, 이름 수정, 순서 변경
- 작품 추가, 삭제, 숨김, 이름 수정, 카테고리 이동, 순서 변경
- 작품 설명, 역할, 연도, 태그, 링크

## 구조

- 공개 페이지: `index.html`
- 관리자 페이지: `admin.html`
- 포트폴리오 데이터: `data/portfolio.json`
- 화면 스타일과 동작: `assets/`

포트폴리오 내용은 `data/portfolio.json`에만 저장합니다.
레이아웃을 수정해도 데이터가 손상되지 않도록 View와 Data를 분리했습니다.
