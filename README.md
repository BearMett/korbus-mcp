# korbus-mcp

서울/경기 실시간 버스 도착 정보를 제공하는 [Model Context Protocol (MCP)](https://modelcontextprotocol.io) 서버입니다.

AI 어시스턴트가 버스 정류장 검색, 노선 조회, 실시간 도착 정보 확인, 알림 설정 등을 수행할 수 있습니다.

## Features

| Tool | Description |
|------|-------------|
| `search_stations` | 정류장 이름으로 검색 (서울 + 경기) |
| `search_routes` | 버스 노선 번호/이름으로 검색 (서울 + 경기) |
| `get_arrivals` | 정류장의 실시간 버스 도착 정보 조회 |
| `create_alarm` | 버스 도착 알림 생성 |
| `list_alarms` | 등록된 알림 목록 조회 |
| `update_alarm` | 기존 알림 수정 |
| `delete_alarm` | 알림 삭제 |
| `poll_now` | 활성 알림에 대해 즉시 도착 정보 확인 및 알림 발송 |

## API 키 발급

이 서버를 사용하려면 [공공데이터포털](https://www.data.go.kr/index.do)에서 API 키를 발급받고, 필요한 서비스를 신청해야 합니다.

### 1단계: 회원가입

[data.go.kr](https://www.data.go.kr/index.do)에 접속하여 회원가입 후 로그인합니다.

### 2단계: API 활용 신청

아래 **6개 서비스**에 각각 활용 신청을 해야 합니다. 링크를 클릭한 뒤 **"활용신청"** 버튼을 누르세요.

**서울 버스** (3개):

| 서비스 | 용도 |
|--------|------|
| [서울특별시_정류소정보조회 서비스](https://www.data.go.kr/data/15000303/openapi.do) | 정류장 검색 |
| [서울특별시_노선정보조회 서비스](https://www.data.go.kr/data/15000193/openapi.do) | 버스 노선 검색 |
| [서울특별시_버스도착정보조회 서비스](https://www.data.go.kr/data/15000314/openapi.do) | 실시간 도착 정보 |

**경기 버스** (3개):

| 서비스 | 용도 |
|--------|------|
| [경기도_정류소 조회](https://www.data.go.kr/data/15080666/openapi.do) | 정류장 검색 |
| [경기도_버스노선 조회](https://www.data.go.kr/data/15080662/openapi.do) | 버스 노선 검색 |
| [경기도_버스도착정보 조회](https://www.data.go.kr/data/15080346/openapi.do) | 실시간 도착 정보 |

### 3단계: 인증키 확인

1. 활용 신청 승인 후 (즉시 ~ 최대 1~2시간), [마이페이지 > 오픈API > 인증키 발급현황](https://www.data.go.kr/iim/api/selectAPIAc498View.do)에서 **일반 인증키**를 복사합니다. (Encoding/Decoding 어느 쪽이든 사용 가능)
2. 동일 계정으로 신청한 서비스들은 같은 인증키를 공유합니다.

### 4단계: 환경변수 설정

발급받은 키를 `KORBUS_DATA_API_KEY`에 설정합니다:

```bash
KORBUS_DATA_API_KEY=your_decoding_key npx korbus-mcp
```

## Quick Start

두 가지 방식으로 사용할 수 있습니다:

### A. OpenClaw 플러그인 (권장)

[OpenClaw](https://openclaw.ai) 게이트웨이에 플러그인으로 설치합니다. 텔레그램, 디스코드, 슬랙 등 OpenClaw이 지원하는 모든 채널로 알림을 받을 수 있습니다.

```bash
openclaw plugins install korbus-mcp
```

플러그인 설정에 API 키를 추가합니다. `~/.openclaw/openclaw.json`을 직접 편집하거나:

```json5
{
  "plugins": {
    "entries": {
      "korbus-mcp": {
        "enabled": true,
        "config": {
          "apiKey": "your_decoding_key"
        }
      }
    }
  }
}
```

또는 환경변수로 설정합니다:

```bash
export KORBUS_DATA_API_KEY=your_decoding_key
```

설정 후 게이트웨이를 재시작합니다:

```bash
openclaw gateway restart
```

설치 확인:

```bash
openclaw plugins list        # korbus-mcp 표시 확인
openclaw doctor              # 전체 상태 점검
```

> **`child_process` 경고**: 설치 시 "Shell command execution detected" 경고가 표시될 수 있습니다. 이는 알람 알림 전송 시 `openclaw message send` CLI를 호출하기 위한 것으로, 임의의 셸 명령을 실행하지 않습니다.

### B. Standalone MCP 서버

MCP 클라이언트(Claude Desktop, Cursor 등)에서 직접 실행합니다:

```bash
KORBUS_DATA_API_KEY=your_key npx korbus-mcp
```

## 환경변수

| Variable | Required | Description |
|----------|----------|-------------|
| `KORBUS_DATA_API_KEY` | Yes | 공공데이터포털 버스 API 인증키 (서울/경기 공용) |
| `TELEGRAM_BOT_TOKEN` | Standalone만 | 텔레그램 알림 봇 토큰 (OpenClaw 모드에서는 불필요) |
| `DATABASE_URL` | No | SQLite DB 경로 (기본: `~/.korbus-mcp/korbus.db`) |

> **참고**: API 키는 인코딩된 값과 디코딩된 값 모두 사용 가능합니다.
>
> OpenClaw 플러그인 모드에서는 `plugins.entries.korbus-mcp.config.apiKey`로도 설정할 수 있습니다.

## MCP 클라이언트 설정 (Standalone)

Standalone MCP 서버로 사용할 때의 클라이언트별 설정입니다.

### Claude Desktop

`claude_desktop_config.json`에 추가:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "korbus": {
      "command": "npx",
      "args": ["-y", "korbus-mcp"],
      "env": {
        "KORBUS_DATA_API_KEY": "your_api_key",
        "TELEGRAM_BOT_TOKEN": "your_bot_token"
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add \
  -e KORBUS_DATA_API_KEY=your_api_key \
  korbus -- npx -y korbus-mcp
```

### Cursor

`.cursor/mcp.json`에 추가:

```json
{
  "mcpServers": {
    "korbus": {
      "command": "npx",
      "args": ["-y", "korbus-mcp"],
      "env": {
        "KORBUS_DATA_API_KEY": "your_api_key"
      }
    }
  }
}
```

### 기타 MCP 클라이언트

stdio 전송 방식을 지원하는 모든 MCP 클라이언트에서 사용할 수 있습니다:

```json
{
  "command": "npx",
  "args": ["-y", "korbus-mcp"],
  "env": {
    "KORBUS_DATA_API_KEY": "your_api_key"
  }
}
```

## 알림 채널

### OpenClaw 플러그인 모드

OpenClaw이 지원하는 모든 채널(Telegram, Discord, Slack, Signal 등)로 알림을 전송합니다. 알람 생성 시 `channel`과 `to` 파라미터로 수신 대상을 지정합니다. 대화 중 알람을 만들면 현재 대화 채널로 자동 설정됩니다.

### Standalone MCP 모드

| 채널 | 설명 | 가이드 |
|------|------|--------|
| Telegram | 텔레그램 메시지로 알림 수신 | [설정 가이드](docs/telegram-setup.md) |
| Webhook | HTTP POST로 외부 서비스에 알림 전송 | [설정 가이드](docs/webhook-setup.md) |
| Console | 서버 로그에 출력 (디버깅용) | — |

## 사용 예시

AI 어시스턴트에게 자연어로 요청하면 됩니다.

### 실시간 도착 정보 조회

> 🧑 강남역에 9404 버스가 언제 오나요?

9404 기준 강남역 실시간 도착이에요.

- 농수산물센터 방면 (신분당선강남역(중) 22009): **2분 후**
- 신사역.푸른저축은행(중) 방면 (신분당선강남역(중) 22010): **0분 후**
- 농수산물센터 방면 (지하철2호선강남역(중) 22011): **0분 후**
- 신사역.푸른저축은행(중) 방면 (지하철2호선강남역(중) 22012): **0분 후**

### 반복 알림 설정

> 🧑 혹시 알림을 아침부터 동작하도록 할 수 있나요?

네, 가능합니다.
알림은 요일별로 startTime~endTime을 지정할 수 있어서
아침 시간부터만 감시하도록 설정할 수 있어요 (예: 평일 07:00~10:00).

> 🧑 그러면 평일 아침 7시~9시에 강남역 9404번 5분 전 알림 만들어주세요

알림을 생성했습니다.

- **라벨:** 출근 9404
- **구간:** 평일(월~금) 07:00 ~ 09:00
- **조건:** 도착 5분 전 알림

### 알림 관리

> 🧑 등록된 알림 목록 보여줘

현재 1개의 알림이 등록되어 있습니다.

1. **출근 9404** (활성) — 강남역 · 9404번
   평일 07:00~09:00, 5분 전 알림

> 🧑 알림 시간을 6시 30분부터로 바꿔줘

수정했습니다.

- **출근 9404:** 평일 06:30 ~ 09:00

## 데이터 영속성

검색된 정류장, 노선, 알림 데이터는 `~/.korbus-mcp/korbus.db` SQLite 파일에 자동 저장됩니다. `npx`로 재실행해도 데이터가 유지됩니다.

`DATABASE_URL` 환경변수로 다른 경로를 지정할 수 있습니다:

```bash
DATABASE_URL="file:/path/to/custom.db" npx korbus-mcp
```

## Development

```bash
git clone https://github.com/BearMett/korbus-mcp.git
cd korbus-mcp
npm install
cp .env.example .env  # API 키 설정
npm run dev
```

```bash
# 빌드
npm run build

# 마이그레이션
npm run db:migrate
```

## License

[MIT](LICENSE)
