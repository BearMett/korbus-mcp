# Webhook 알림 설정 가이드

korbus-mcp에서 Webhook을 통해 외부 서비스로 버스 도착 알림을 전송하기 위한 설정 가이드입니다.

## 개요

Webhook 채널은 버스 도착 조건이 충족되면 지정된 URL로 **HTTP POST** 요청을 보냅니다. Slack, Discord, 자체 서버 등 HTTP 요청을 수신할 수 있는 모든 서비스와 연동할 수 있습니다.

## 알람 생성 시 채널 설정

AI 어시스턴트에게 요청:

> "매일 아침 8시에 강남역 341번 버스 도착 알림을 https://example.com/webhook 으로 보내줘."

또는 `create_alarm` 도구의 `channels` 파라미터에 직접 설정:

```json
{
  "channels": [
    {
      "type": "WEBHOOK",
      "config": {
        "url": "https://example.com/webhook"
      }
    }
  ]
}
```

- `url`은 유효한 URL 형식이어야 합니다 (`http://` 또는 `https://`로 시작).
- URL 형식이 올바르지 않으면 알람 생성 시 검증 오류가 발생합니다.

## 수신 Payload 구조

Webhook으로 전송되는 JSON payload는 다음과 같습니다:

```json
{
  "alarmId": "uuid-string",
  "stationName": "강남역",
  "routeName": "341",
  "arrivalSec": 120,
  "arrivalMsg": "곧 도착",
  "vehicleId": "SEOUL74321"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `alarmId` | string | 알람 UUID |
| `stationName` | string | 정류장 이름 |
| `routeName` | string | 버스 노선명 |
| `arrivalSec` | number | 예상 도착 시간(초) |
| `arrivalMsg` | string | 도착 안내 메시지 |
| `vehicleId` | string | 차량 식별자 |

## 활용 예시

### Slack Incoming Webhook

Slack의 Incoming Webhook URL을 직접 사용하려면 Slack이 기대하는 `text` 형식으로 변환하는 중간 서버가 필요합니다. 또는 Slack Workflow Builder를 활용하여 JSON payload를 수신할 수 있습니다.

```json
{
  "type": "WEBHOOK",
  "config": {
    "url": "https://hooks.slack.com/workflows/T00000/..."
  }
}
```

### Discord Webhook

Discord Webhook도 자체 포맷(`content` 필드)을 요구하므로, 중간 변환 서버를 거쳐 사용합니다.

```json
{
  "type": "WEBHOOK",
  "config": {
    "url": "https://discord.com/api/webhooks/1234567890/abcdef..."
  }
}
```

### 자체 서버

JSON payload를 그대로 수신하는 자체 서버에 가장 적합합니다:

```json
{
  "type": "WEBHOOK",
  "config": {
    "url": "https://my-server.example.com/bus-notify"
  }
}
```

간단한 수신 서버 예시 (Node.js):

```javascript
const http = require('http');

http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const payload = JSON.parse(body);
    console.log(`${payload.routeName}번 버스 → ${payload.stationName}: ${payload.arrivalMsg}`);
    res.writeHead(200);
    res.end('OK');
  });
}).listen(3000);
```

## 참고 사항

- **타임아웃**: HTTP 요청 타임아웃은 **10초**입니다. 응답이 10초 이내에 오지 않으면 전송 실패로 처리됩니다.
- **환경변수 불필요**: Webhook은 별도의 환경변수 설정 없이 URL만으로 동작합니다.
- **중복 방지**: 동일 차량에 대해 10분 내 중복 알림이 발송되지 않습니다.
