# fedops-web-onprem

온프레미스용 정제 소스와 설정 외부화 작업본입니다. 기존 Git 이력의 fork가 아닌 새 초기 이력입니다. 원본 라이선스와 저작자 표기를 유지합니다.

- 원본 범위·파일 해시: [SOURCE_PROVENANCE.json](SOURCE_PROVENANCE.json). 전달본은 일부 저장소의 부분 export입니다.
- 포함된 Dockerfile은 로컬 검증에 사용한 digest 기반 레시피입니다. .env·실제 자격정보는 포함하지 않습니다.
- 새 Task는 검증된 Baseline 0.19.1(`eb54b25473e387c50b343c9382bdad74e297c3a6`)을 제공합니다. FedOps 1.1.30.19+onprem.20260916 / core commit `ff5f44ddea2705c8d901a54a0272f517822da8f4`를 명시적으로 선택하며 기존 Task의 고정 버전은 유지합니다.
- Linux Backend 이미지에서 `FL_SERVER_MANAGER_URL=http://manager.invalid:8000 node --test test/*.test.js` 104개 통과. 최초 검사에서 필수 테스트 설정 누락과 fixture 자동 검색을 확인한 후 위 명령으로 검증했습니다. F 비공개 Git 인증·실제 Task/FL 실행은 별도입니다.
- 기존 upstream 자동 게시 workflow는 실행하지 않도록 이관에서 제외했습니다.
- 배포 설정: https://github.com/minsoojo/fedops-deployment

## Lens / localhost 접속 (2026-09-17)

Frontend 한 포트를 포워딩해 `http://localhost:<port>/fedops/`로 접속한다. Chart의 browser runtime 설정은 API/Socket 도메인을 강제하지 않아 현재 페이지 origin을 사용한다. `/fedops/api`와 `/socket.io`는 기존 Frontend 프록시가 내부 Backend로 전달한다. hosts 등록이나 localhost CORS wildcard 추가는 필요 없다.

모델/파일 다운로드 링크는 설정된 `objectStorageOrigin`에 해당할 때만 `/fedops/objects/...`로 바뀐다. Frontend는 `OBJECT_STORAGE_PROXY_TARGET`(내부 MinIO)에 전달하면서 `OBJECT_STORAGE_PUBLIC_ORIGIN`의 Host와 원래 경로·쿼리를 유지해 S3 서명을 검증받는다. GET/HEAD만 허용하고 Web 로그인 Cookie/Authorization은 MinIO에 전달하지 않는다. 외부 URL을 대상으로 하는 임의 프록시는 제공하지 않는다.

수정 Frontend 이미지와 Chart 설정을 함께 적용한다. 외부 FL 장치의 TCP 통신과 다운로드한 클라이언트 설정의 Manager 주소는 브라우저 포워딩과 별도다. 기존 도메인 접속도 같은 코드로 지원한다.
