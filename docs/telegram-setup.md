# 텔레그램 알림 설정 가이드

korbus-mcp에서 텔레그램으로 버스 도착 알림을 받기 위한 설정 가이드입니다.

## 1. 텔레그램 봇 생성

1. 텔레그램에서 [BotFather](https://t.me/BotFather)를 검색하여 대화를 시작합니다.
2. `/newbot` 명령을 입력합니다.
3. 봇 이름을 입력합니다 (예: `내 버스 알림`).
4. 봇 사용자명을 입력합니다 (예: `my_bus_alert_bot`). `_bot`으로 끝나야 합니다.
5. 생성이 완료되면 **봇 토큰**이 표시됩니다:
   ```
   Use this token to access the HTTP API:
   123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   ```
6. 이 토큰을 안전하게 보관합니다.

## 2. 환경변수 설정

봇 토큰을 `TELEGRAM_BOT_TOKEN` 환경변수로 설정합니다.

### npx 실행 시

```bash
BUS_API_KEY=your_key TELEGRAM_BOT_TOKEN=your_bot_token npx korbus-mcp
```

### Claude Desktop

`claude_desktop_config.json`의 `env`에 추가:

```json
{
  "mcpServers": {
    "korbus": {
      "command": "npx",
      "args": ["-y", "korbus-mcp"],
      "env": {
        "BUS_API_KEY": "your_api_key",
        "TELEGRAM_BOT_TOKEN": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
      }
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add \
  -e BUS_API_KEY=your_api_key \
  -e TELEGRAM_BOT_TOKEN=your_bot_token \
  korbus -- npx -y korbus-mcp
```

## 3. chatId 확인

텔레그램 알림을 받으려면 대화의 **chatId**가 필요합니다.

### 개인 chatId 확인

1. 텔레그램에서 생성한 봇을 검색하여 `/start`를 보냅니다.
2. 브라우저에서 다음 URL을 열어 최근 메시지를 확인합니다:
   ```
   https://api.telegram.org/bot{YOUR_BOT_TOKEN}/getUpdates
   ```
3. 응답 JSON에서 `chat.id` 값을 찾습니다:
   ```json
   {
     "result": [{
       "message": {
         "chat": {
           "id": 123456789,
           "type": "private"
         }
       }
     }]
   }
   ```
4. `123456789`가 개인 chatId입니다.

### 그룹 채팅 chatId 확인

1. 봇을 그룹에 초대합니다.
2. 그룹에서 아무 메시지를 보냅니다.
3. 위와 동일하게 `/getUpdates` API를 호출합니다.
4. 그룹 chatId는 **음수**입니다 (예: `-987654321`).

> **팁**: `/getUpdates`에 결과가 없으면, 봇에게 메시지를 보낸 후 다시 시도하세요.

## 4. 알람 생성 시 채널 설정

AI 어시스턴트에게 텔레그램 알림을 요청하면 됩니다:

> "매일 아침 8시에 강남역 341번 버스 도착 알림을 텔레그램으로 보내줘. chatId는 123456789야."

또는 `create_alarm` 도구의 `channels` 파라미터에 직접 설정:

```json
{
  "channels": [
    {
      "type": "TELEGRAM",
      "config": {
        "chatId": "123456789"
      }
    }
  ]
}
```

- `chatId`는 문자열로 입력합니다.
- `botToken`은 환경변수에서 자동으로 사용되므로 별도 설정이 필요 없습니다.

## 5. 메시지 포맷

알림은 다음 형식으로 전송됩니다:

```
Bus 341 → 강남역
곧 도착 (120s)
Vehicle: SEOUL74321
```

| 항목 | 설명 |
|------|------|
| `341` | 버스 노선명 |
| `강남역` | 정류장 이름 |
| `곧 도착` | 도착 안내 메시지 |
| `120s` | 예상 도착 시간(초) |
| `SEOUL74321` | 차량 식별자 |

## 트러블슈팅

### 알림이 오지 않는 경우

- **`TELEGRAM_BOT_TOKEN` 미설정**: 토큰이 없으면 텔레그램 채널은 무시됩니다. 환경변수가 올바르게 설정되었는지 확인하세요.
- **chatId 오류**: chatId가 정확한지 `/getUpdates`로 다시 확인하세요. 그룹 chatId는 음수입니다.
- **봇이 그룹에 없음**: 그룹 알림을 받으려면 봇이 해당 그룹의 멤버여야 합니다.
- **봇에게 `/start` 안 함**: 개인 대화에서 봇에게 먼저 `/start`를 보내야 메시지를 받을 수 있습니다.

### 타임아웃

텔레그램 API 호출 타임아웃은 **10초**입니다. 네트워크 문제로 전송에 실패하면 해당 알림은 건너뜁니다.
