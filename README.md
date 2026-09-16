# FedOps Web

FedOps Web은 Federated Task를 만들고 공개하며, 참여 승인과 연합학습 집계 서버를 관리하는
FedOps의 Web control plane입니다. 제품 UI의 표시는 **FedOps ver 1.3 Beta**를 사용합니다.

## 주요 기능

- FedOps 계정 생성, 로그인과 Registry identity
- 공개 Federated Task를 탐색하는 Registry
- 소유하거나 참여 중인 Task를 구분하는 My Federated Tasks
- Task 생성, 공개 범위와 참여 정책 설정
- 참여 요청, 승인과 참여 상태 관리
- Kubernetes 기반 FL Server lifecycle 및 Runtime Overview
- Task Card Markdown 편집
- Release snapshot 기반 Files & Versions, 파일 preview와 download
- Global Model version, download와 사용 통계
- 연합학습 Monitoring, round/client/system metric
- News와 Blog 콘텐츠
- FedOps Agent Studio용 인증 API와 Baseline release 공급

## 시스템 경계

```text
Browser
  → React frontend
  → Koa API / Socket.IO
      ├ MongoDB: 계정, Task, 참여, Release/Model metadata
      ├ bundled asset: 검증된 Federated Task Baseline
      ├ Registry API / MinIO: Release bundle과 Global Model 본문
      ├ S3: 기존 Task의 Files & Versions와 Global Model 호환 경로
      ├ Kubernetes / Server Manager: FL runtime
      └ FedOps Agent Studio: Task/Baseline/Registry 연계
```

FedOps Web은 Task와 서버의 control plane입니다. 로컬 데이터, 로컬 모델 개발, Python 환경과
참여 client 실행은 FedOps Agent Studio가 담당합니다. 사용자 raw dataset은 Web이나 S3에
업로드하지 않습니다.

## 저장소 구조

```text
FedOps-Web/
├── client/                 React frontend
│   ├── public/             favicon, manifest와 정적 asset
│   └── src/
│       ├── components/     auth, route, Task, monitoring UI
│       ├── pages/          페이지 단위 화면
│       ├── modules/        Redux state와 action
│       ├── lib/api/        backend API adapter
│       └── theme/          Web theme와 공통 style
├── server/                 Node.js Koa backend
│   ├── src/api/            auth, tasks, model, baseline, news/blog endpoint
│   ├── src/models/         Mongoose model
│   ├── src/lib/            권한, Task file, monitoring과 공통 domain logic
│   ├── src/sockets/        Task와 monitoring Socket.IO
│   ├── scripts/            migration과 Baseline release 도구
│   └── test/               Node contract/unit test
└── deployments/
    ├── frontend/           Kubernetes Deployment와 Service
    └── backend/            Kubernetes Deployment와 Service
```

## 데이터 소유권

| 데이터 | 저장 위치 |
| --- | --- |
| 사용자와 인증 정보 | MongoDB |
| Federated Task와 참여 정책 | MongoDB `fl.task` |
| 참여 요청과 승인 | MongoDB `fl.task_participant` |
| Task Release와 Global Model metadata | MongoDB |
| 신규 Files & Versions 본문 | Registry API의 `task-assets` namespace / MinIO |
| 신규 Global Model 본문 | Registry API의 `global-models` namespace / MinIO |
| Federated Task Baseline 0.12.0 | Web backend image의 검증된 bundled asset |
| 기존 Task file과 model 본문 | 기존 S3 호환 경로 |
| 실행 중 집계 서버 log/checkpoint/state | Kubernetes runtime와 PVC |
| 참여자 raw dataset | Agent Studio가 실행되는 사용자 로컬 장치 |

## Federated Task와 Registry

Web에서 만든 Task에는 visibility와 participation policy가 있습니다.

- `private`: Owner와 승인된 사용자만 조회
- `public`: 공개 후보가 될 수 있지만 Publish 전에는 Registry에 노출되지 않음
- `closed`: 신규 참여를 받지 않음
- `approval_required`: Owner 승인 후 참여
- `open`: 요청 즉시 참여 승인

신규 Task는 먼저 `draft`로 생성됩니다. Agent Studio에서 Web Draft를 연결하거나 로컬
프로젝트를 Federated Task로 전환해 개발한 뒤, Local Training과 Release Readiness를 통과한
source snapshot과 initial/global model을 Release Candidate로 제출합니다. Owner가 Web에서
명시적으로 Publish해야 현재 Release snapshot이 Registry에 보입니다. visibility만 `public`으로
바꾸는 것은 Publish가 아닙니다.

새 v3 Draft 생성 시 Web에서 먼저 정하는 값은 Federated Task 이름, `@owner/slug` Registry ID,
Primary Model의 작업 이름, Task 분류/데이터 형식, Summary/Tags, visibility와 participation
policy입니다. 모델 구조, 입력 feature, 데이터 전처리, local training 값은 아직 검증되지 않은
단계이므로 Create 화면에서 받지 않고 Agent Studio의 Baseline 프로젝트에서 완성합니다.
MongoDB `title`은 기존 Kubernetes 호환을 위한 내부 runtime key이고, 사용자에게는
`displayName`을 보여줍니다. Registry는 Release Readiness에서 확정된
`primaryModel.displayName`을 중심 제목으로 표시하되 소속 Federated Task 이름도 함께 표시합니다.

Create 화면의 Creation Mode는 모든 사용자에게 표시되며 `Federated Task (FedOps 1.3)`가 기본값입니다.
`Legacy Task (FedOps 1.2)`를 선택하면 Title, 모델/데이터셋, 학습, 집계, XAI/Clustering 값을 직접
입력해 기존 YAML과 runtime 계약으로 생성합니다. `SBA-FL Legacy Task`는 관리자에게만 표시되며
SBA-FL 전용 고정 Task ID와 비공개 정책을 유지합니다. 일반 사용자의 상세 Model Type에도 SBA-FL은
표시되지 않고 backend도 비관리자의 SBA-FL 생성 요청을 거부합니다.

Publish된 Task의 Task Card는 해당 Release의 `README.md`이며 Files & Versions도 같은 Release
ZIP의 파일 목록입니다. 따라서 파일별 `latest`를 섞지 않고, 참여자는 Owner가 검증한 동일한
소스·설정·모델 조합을 받습니다. 새 Release Candidate는 기존 공개본을 덮지 않으며 Owner가
다시 Publish할 때 공개 revision이 원자적으로 전환됩니다.

## Baseline release

`FedOps-SiloBaseline` 저장소는 Baseline을 설계하고 검증하며 이력을 남기는 원본입니다. 실행
중인 Web이나 Agent Studio는 이 Git 저장소를 clone/pull하지 않습니다. 검증된 0.12.0 export는
Web backend가 다음 경로에 직접 포함합니다.

```text
server/assets/federated-task-baseline/0.12.0/
├── baseline-manifest.json
├── provenance.json
└── files/...
```

0.12.0은 Owner 편집 영역을 `local_training/`, `tool_ai/`, `conf/`로, FedOps 관리 영역을
`federated_learning/`, `task_readiness/`, `runtime/`으로 구분합니다. Task 라이브러리는
Owner가 `requirements.txt`에 `library==version` 형식으로 작성하고 `pyproject.toml`과 `uv.lock`은
Agent Studio와 uv가 관리합니다. Tool AI의 사용자 manifest는
`description`, `features`, `output.description`, `output.labels`만 가지며 실제 Python entrypoint와
Model Release 형식은 고정 Task 계약에서 관리합니다. 기존 0.11.0 이하 asset은 변경하지 않고 기존
Workspace 다운로드 호환을 위해 계속 보존합니다.

0.12.0의 FedOps 관리 runtime은 Local Train 단계와 batch 진행률을 구조화된 event로 전달합니다.
Task의 `train_model`/`evaluate_model` 함수 시그니처는 바꾸지 않으며, 선택적 metric helper를 호출하면
Agent Studio가 학습 loss, 검증 loss, accuracy와 Task별 추가 지표를 실시간 card와 graph로 표시합니다.

Agent Studio는 Task마다 계정 로컬
`.local-data/federated-tasks/<local-project>/dataset`을 만들고 Local Train과 Participation
Readiness에 자동 주입합니다. 이 디렉토리는 Baseline source와 Registry Release에 포함되지 않습니다.

로그인된 Agent Studio는 `GET /fedops/api/baselines/default?distribution=bundled`로 manifest와
opaque artifact ID를 받고, 인증된 Web endpoint에서 각 파일을 내려받습니다. Web은 매 요청에서
크기와 SHA-256을 검증하며 Studio도 수신 후 다시 검증합니다. Git, Registry API, MinIO, S3의
credential은 Studio에 전달하지 않습니다.

Baseline을 변경할 때는 항상 새 version으로 `FedOps-SiloBaseline`을 검증·commit·tag·push한 후,
동일 commit에서 생성한 export를 Web asset에 명시적으로 vendoring하고 Web도 함께 push합니다.
두 저장소 중 한 곳만 갱신한 상태로 작업을 완료하지 않습니다. 기존 version을 덮어쓰지 않고
provenance에 source commit과 manifest SHA-256을 함께 기록합니다.

```bash
cd ../FedOps-SiloBaseline
cd federated-task-baseline
uv sync --locked --extra participate --link-mode copy
cd ..
federated-task-baseline/.venv/bin/python -m unittest discover -s tests
federated-task-baseline/.venv/bin/python tools/build_release.py

cd ../FedOps-Web/server
npm test
```

Baseline authoring Git과 제품 배포 asset이 일치하는지는 manifest/provenance test가 검사합니다.

## Task Release 저장 흐름

Agent Studio는 initial model과 deterministic Release ZIP을 FedOps Web에만 업로드합니다. Web은
Owner 권한, upload 크기와 hash, ZIP 경로, 필수 파일, readiness 결과, source/model signature를
검증한 뒤 기존 Registry API의 파일 PUT/GET을 호출합니다. Registry API 자체는 수정하지 않으며
Web만 내부 Service 주소와 저장 credential 경계를 압니다.

```text
Agent Studio → authenticated FedOps Web
             → Registry API
                ├ task-assets/<taskId>/...   Release ZIP
                └ global-models/<taskId>/... model artifact
             → MinIO object storage
```

Web은 Registry API에 저장한 직후 다시 내려받아 크기와 SHA-256을 확인한 경우에만 Candidate를
`ready`로 기록합니다. 참여자가 Studio에서 Published Task를 열 때도 Web의 인증·권한 경계를
통해 정확한 Release와 model을 받고, 참여자 데이터는 로컬 Workspace 밖으로 업로드하지 않습니다.

승인된 Owner/Participant가 Agent Studio에서 참여를 시작할 때 Web은 Published Release, Initial
Model, runtime contract, 현재 aggregation endpoint를 하나의 participation manifest로 제공합니다.
신규 `federated-task-v3` 집계 서버도 GitHub `main`을 clone하지 않고 동일 Release ZIP과 model을
서명된 단기 내부 URL로 받아 SHA-256 검증 후 실행합니다. 기존 Task는 저장된 legacy/v2 runtime
contract를 유지하므로 이 경로로 암묵적으로 전환되지 않습니다.

연합학습 실행 횟수와 규모는 Release와 별도의 `Campaign`입니다. Server Management에서 Owner가
라운드 수, 라운드당 클라이언트 수와 Release가 지원하는 전략을 선택하면 Web이 MongoDB에 저장하고
Server Manager에는 검증된 `campaign_config`만 전달합니다. Server Manager는 같은 JSON을
`FEDOPS_CAMPAIGN_CONFIG` 환경변수로 Pod에 주입하므로, 동일한 검증 Release를 여러 Campaign에서
재사용할 수 있습니다. 실행 중 상태와 Campaign은 Kubernetes Deployment에서도 복구됩니다.

테스트 중 생성된 object를 정리하기 전에는 다음 읽기 전용 명령으로 MongoDB metadata에 없는
파일만 보고합니다. 이 명령은 삭제를 수행하지 않습니다.

```bash
cd server
npm run audit:registry-artifacts
```

## 로컬 개발

요구 사항:

- Node.js 18 이상
- npm 또는 저장소의 Yarn 설정
- MongoDB
- Files & Versions 기능을 사용할 경우 S3 credential

Backend:

```bash
cd server
cp example.env .env
npm install
npm run start:dev
```

기본 API 경로는 `http://localhost:4000/fedops/api`입니다.

Frontend:

```bash
cd client
npm install
npm start
```

기본 frontend 개발 주소는 `http://localhost:3000/fedops`입니다. 환경별 backend 주소는
React 환경변수 또는 개발 proxy로 설정합니다. 실제 Secret과 운영 `.env`는 commit하지 않습니다.

## 환경변수

주요 backend 설정:

| 변수 | 용도 |
| --- | --- |
| `PORT` | Koa API port, 기본 4000 |
| `MONGO_URI` | 운영 MongoDB 연결 문자열 |
| `JWT_SECRET` | 인증 token signing secret |
| `BUCKET_NAME` | 기존 Task file/Global Model S3 호환 bucket |
| `REGION_NAME` | S3 region |
| `ACCESS_KEY_ID`, `ACCESS_SECRET_KEY` | S3 접근 정보 또는 workload credential |
| `REGISTRY_API_BASE_URL` | Web backend만 사용하는 Registry API 내부 주소 |
| `REGISTRY_API_TIMEOUT_MS` | Registry API 요청 timeout, 기본 30000ms |

값이 없는 예시는 `server/example.env`에서 확인합니다. Secret 값은 README, source, Kubernetes
manifest에 직접 작성하지 않습니다.

## 테스트

Backend contract/unit test:

```bash
cd server
npm test
```

변경 파일 lint:

```bash
cd server
npx eslint src test
```

Frontend:

```bash
cd client
npm test
npm run build
```

## 배포

`deployments/frontend`와 `deployments/backend`는 다음 RollingUpdate 정책을 사용합니다.

```text
maxUnavailable: 0
maxSurge: 1
minReadySeconds: 5
```

`main` 변경을 ArgoCD가 감지하면 기존 Ready Pod를 유지한 채 새 Pod를 만들고 readiness가
통과한 뒤 교체합니다. 배포 후 확인 항목:

```bash
kubectl -n fedops rollout status deployment/fedops-web-backend
kubectl -n fedops rollout status deployment/fedops-web-frontend
kubectl -n fedops get pods -l app=fedops-web-backend
kubectl -n fedops get pods -l app=fedops-web-frontend
```

Backend health endpoint는 `/fedops/api/health`입니다. Baseline version을 전환할 때는 authoring
repository 검증, Web vendored asset 검증, rolling deployment 순서로 진행합니다. Registry API,
MinIO와 MongoDB는 이 Web 배포 때문에 재시작하지 않습니다.

## 관련 저장소

- `FedOps-SiloBaseline`: local/federated training project release 원본
- `FedOps-AgentStudio`: 로컬 Workspace, Python runtime, Federated Task 개발과 참여
- `FedOps`: 연합학습 Python library
- `FedOps-Server`: Kubernetes FL Server Manager와 집계 서버 lifecycle
