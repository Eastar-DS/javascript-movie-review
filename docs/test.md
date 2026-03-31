# 1. 미션 내용
📍학습 목표
API 연동을 통한 비동기 통신 학습
사용자 시나리오 기반 E2E 테스트


🎯 기능 요구사항
공통 요구사항
1. 🎬 영화 목록 조회 (인기순)
영화 목록(https://developer.themoviedb.org/reference/movie-popular-list)의 1페이지를 불러오며 더보기 버튼을 누르면 그 다음의 영화 목록을 불러 올 수 있다.
페이지 끝에 도달한 경우에는 더보기 버튼을 화면에 출력하지 않는다.
영화는 한 번의 요청당 20개씩 영화 목록을 보여준다.
영화 목록을 불러오는 동안 Skeleton UI 를 보여준다
Skeleton UI는 템플릿으로 제공되는 파일 이외로 자유롭게 구현할 수 있다.
2. 🔎 검색
영화 검색 API(https://developer.themoviedb.org/reference/search-movie)를 이용하여 내가 보고 싶은 영화를 검색할 수 있다.
엔터키를 눌러 검색할 수 있다
검색 버튼을 클릭하여 검색할 수 있다
영화 목록 조회와 같이 검색한 결과에 한해 정보를 보여주는 화면의 요구사항은 동일하다
3. ⚠️ 오류
오류가 발생하는 경우에는 사용자를 위한 오류 메시지를 띄워 준다.
어떤 오류를 대응해야 하고, 어떤 UI로 보여줄 것인지는 자율적으로 결정한다.
UI
다음의 Figma 시안을 기준으로 구현한다.
figma 시안 : https://www.figma.com/design/FGOObkPm0IvnRo4mn0sxLp/-FE--%EB%A0%88%EB%B2%A81-%EC%98%81%ED%99%94-%EB%A6%AC%EB%B7%B0-1%EB%8B%A8%EA%B3%84_v2--Copy-?node-id=3-307&t=wWRapKEs2vxhRD42-0

배포
실행 가능한 페이지에 접근할 수 있도록 github page 기능을 이용하고, 해당 링크를 PR과 README에 작성한다.

✅ 프로그래밍 요구사항
이전 미션의 프로그래밍 요구사항을 기본으로 포함한다.

테스트 전략을 세우고, 단위 테스트(vitest), E2E 테스트(cypress)를 진행한다.
핵심이 되는 기능이라고 생각하는 기능 플로우를 선정하고 그에 대한 E2E 테스트를 추가한다.
E2E 테스트 도구를 이용하여 UI Test를 진행해 본다.
API key를 공개된 저장소에 포함하지 않는다.
비동기 통신에서 실패할 경우를 대비한다.
비동기 통신에서 일어날 수 있는 다양한 상황을 고려해 본다.
API 통신 실패 케이스를 테스트에 포함한다.
TypeScript를 사용해 구현한다.

MVC 패턴, React 를 따라 만드는 패턴을 사용하지 않는다. 기능 하나씩 만들면서, 커져가는 프로젝트를 보면서, 프로젝트에 맞는 패턴을 스스로 찾는다.
templates 에서 제공된 html, css 을 활용한다.

🚨🚨🚨 주의사항 🚨🚨🚨
API를 사용하기 위해서는 개인 key를 발급받아서 이용해야 합니다. 

TMDB api 읽기 엑세스 토큰 : eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJhZDFmZTJkZjEwZDNhMTIxNmY5YzhjYzA5MDdlYzc3NyIsIm5iZiI6MTc3NDg1MDk4MS4zNTMsInN1YiI6IjY5Y2ExM2E1YjQwNDUwOTdmZjczMmNjZSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.pMlpwW3109kLfNMg6nIZBC8HdNQ26wK4qQNKO_dV0Dk

이 key는 보안상 중요한 값이기 때문에 🚨공개된 Git history에 남지 않도록 주의하세요.🚨 단, 미션 진행 시에는 API KEY 값은 환경 변수에 등록하여 사용하세요.
단, 미션에서는 웹 요청 시 개발자 도구의 네트워크 탭에서 API KEY 값이 드러날 수밖에 없습니다. (네트워크 탭에서 API KEY값을 숨기려고 하는 것이 이번 미션의 의도도 학습 목표도 아닙니다.)

API 요청 수에 대한 제한은 없지만, 반복문과 같은 형태로 과도한 요청이 발생하지 않도록 주의하세요. 미션에 필요한 API 사용에 제한을 받으면 미션 진행이 어려울 수 있습니다.

📝 과제 진행 요구사항
기능 목록 및 commit 로그 요구 사항
기능을 구현하기 전에 README.md 파일에 구현할 기능 목록을 정리해 추가한다.
git의 commit 단위는 앞 단계에서 README.md 파일에 정리한 기능 목록 단위로 추가한다.

# 2. 너의 [역할]
너는 10년차 시니어 프론트 엔지니어이고, 우아한 테크코스에서 주니어 개발자를 양성하기 위해 교육하고있어.

# 3. [지침]
이번 미션을 수행하기 위해 아래 과정을 단계단계 거쳐가며, 나에게 점점 발전해나가는 코드를 작성하고 교육할거야.
1. 피그마 시안을 바탕으로 html, css, ts 파일을 1차적으로 작성할거야.
2. 기본적인 테스트코드를 작성할거야. 필요한 단위테스트와 미션수행을 위한 e2e테스트를 cypress로 작성할거야.
3. 1번에서 작성한 코드를 바탕으로 apiClient, 컴포넌트 등을 만들어서 재사용성을 늘리는 등 어떤 부분을 리팩토링 하면 좋을지 하나하나 확인하며 더 좋은 코드를 만들거야.
4. 이번 미션에서 가장 좋은 아키텍처나 폴더구조등이 뭔지 생각해보고 최종적으로 리팩토링을 진행할거야.

한번에 한단계씩 진행할거고, 교육을 위한 md파일도 필요하다면 docs 폴더 안에 작성해줘.