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

이 서버를 사용하려면 공공데이터포털에서 API 키를 발급받아야 합니다.

1. [data.go.kr](https://www.data.go.kr/) 회원가입
2. 다음 API를 각각 활용 신청:
   - [서울특별시 버스도착정보조회 서비스](https://www.data.go.kr/data/15000314/openapi.do)
   - [경기도 버스도착정보 조회 서비스](https://www.data.go.kr/data/15080346/openapi.do)
3. (선택) 텔레그램 알림을 사용하려면 [BotFather](https://t.me/BotFather)에서 봇 토큰을 발급받으세요.

## Quick Start

```bash
SEOUL_BUS_API_KEY=your_key GYEONGGI_BUS_API_KEY=your_key npx korbus-mcp
```

## 환경변수

| Variable | Required | Description |
|----------|----------|-------------|
| `SEOUL_BUS_API_KEY` | Yes | 서울 버스 API 인증키 |
| `GYEONGGI_BUS_API_KEY` | Yes | 경기 버스 API 인증키 |
| `TELEGRAM_BOT_TOKEN` | No | 텔레그램 알림 봇 토큰 |
| `DATABASE_URL` | No | SQLite DB 경로 (기본: `~/.korbus-mcp/korbus.db`) |

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
        "SEOUL_BUS_API_KEY": "your_seoul_key",
        "GYEONGGI_BUS_API_KEY": "your_gyeonggi_key",
        "TELEGRAM_BOT_TOKEN": "your_bot_token"
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add \
  -e SEOUL_BUS_API_KEY=your_seoul_key \
  -e GYEONGGI_BUS_API_KEY=your_gyeonggi_key \
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
        "SEOUL_BUS_API_KEY": "your_seoul_key",
        "GYEONGGI_BUS_API_KEY": "your_gyeonggi_key"
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
    "SEOUL_BUS_API_KEY": "your_seoul_key",
    "GYEONGGI_BUS_API_KEY": "your_gyeonggi_key"
  }
}
```

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
