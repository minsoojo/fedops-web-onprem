# fedops-web-onprem

온프레미스용 정제 소스와 설정 외부화 작업본입니다. 기존 Git 이력의 fork가 아닌 새 초기 이력입니다. 원본 라이선스와 저작자 표기를 유지합니다.

- 원본 범위·파일 해시: [SOURCE_PROVENANCE.json](SOURCE_PROVENANCE.json). 전달본은 일부 저장소의 부분 export입니다.
- 포함된 Dockerfile은 로컬 검증에 사용한 digest 기반 레시피입니다. .env·실제 자격정보는 포함하지 않습니다.
- 새 Task는 검증된 Baseline 0.19.1(`eb54b25473e387c50b343c9382bdad74e297c3a6`)을 제공합니다. FedOps 1.1.30.19+onprem.20260916 / core commit `ff5f44ddea2705c8d901a54a0272f517822da8f4`를 명시적으로 선택하며 기존 Task의 고정 버전은 유지합니다.
- Linux Backend 이미지에서 `FL_SERVER_MANAGER_URL=http://manager.invalid:8000 node --test test/*.test.js` 104개 통과. 최초 검사에서 필수 테스트 설정 누락과 fixture 자동 검색을 확인한 후 위 명령으로 검증했습니다. F 비공개 Git 인증·실제 Task/FL 실행은 별도입니다.
- 기존 upstream 자동 게시 workflow는 실행하지 않도록 이관에서 제외했습니다.
- 배포 설정: https://github.com/minsoojo/fedops-deployment
