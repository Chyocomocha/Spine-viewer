# Spine Portfolio

GitHub Pages용 정적 Spine 포트폴리오입니다.

## 포트폴리오 내용 수정

작품 목록, 제목, 카테고리, 표시 순서는 `data/portfolio.json`에서 수정합니다.

- 사이트 제목: `site.title`
- 사이트 설명: `site.subtitle`
- 처음 열 작품: `site.defaultItemId`
- 카테고리 이름과 순서: `categories` 배열의 `title`과 배열 순서
- 작품 이름과 순서: 각 카테고리의 `items` 배열의 `name`과 배열 순서
- 목차에서 숨기기: 카테고리나 작품에 `"hidden": true` 추가

레이아웃 수정은 `index.html`, `assets/portfolio.css`, `assets/portfolio.js`에서만 합니다.
포트폴리오 데이터는 HTML 안에 직접 넣지 않습니다.
