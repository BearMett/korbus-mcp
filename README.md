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

> **참고**: 서울 또는 경기 중 한 지역만 사용한다면 해당 지역의 3개만 신청해도 됩니다.

### 3단계: 인증키 확인

1. 활용 신청 승인 후 (즉시 ~ 최대 1~2시간), [마이페이지 > 오픈API > 인증키 발급현황](https://www.data.go.kr/iim/api/selectAPIAc498View.do)에서 **일반 인증키 (Decoding)** 을 복사합니다.
2. 동일 계정으로 신청한 서비스들은 같은 인증키를 공유합니다.

### 4단계: 환경변수 설정

발급받은 키를 `KORBUS_DATA_API_KEY`에 설정합니다:

```bash
KORBUS_DATA_API_KEY=your_decoding_key npx korbus-mcp
```

## Quick Start

```bash
KORBUS_DATA_API_KEY=your_key npx korbus-mcp
```

## 환경변수

| Variable | Required | Description |
|----------|----------|-------------|
| `KORBUS_DATA_API_KEY` | Yes | 공공데이터포털 버스 API 인증키 (서울/경기 공용) |
| `TELEGRAM_BOT_TOKEN` | No | 텔레그램 알림 봇 토큰 |
| `DATABASE_URL` | No | SQLite DB 경로 (기본: `~/.korbus-mcp/korbus.db`) |

> **참고**: API 키는 인코딩된 값과 디코딩된 값 모두 사용 가능합니다.

## MCP 클라이언트 설정

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

## 알림 설정

알람 생성 시 다음 채널을 통해 도착 알림을 받을 수 있습니다:

| 채널 | 설명 | 가이드 |
|------|------|--------|
| Telegram | 텔레그램 메시지로 알림 수신 | [설정 가이드](docs/telegram-setup.md) |
| Webhook | HTTP POST로 외부 서비스에 알림 전송 | [설정 가이드](docs/webhook-setup.md) |
| Console | 서버 로그에 출력 (디버깅용) | — |

## 사용 예시

AI 어시스턴트에게 자연어로 요청하세요:

- "강남역 정류장 검색해줘"
- "341번 버스 노선 찾아줘"
- "강남역 정류장에 341번 버스 언제 오는지 알려줘"
- "매일 아침 8시에 강남역 341번 버스 도착 알림 만들어줘"
- "등록된 알림 목록 보여줘"

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
